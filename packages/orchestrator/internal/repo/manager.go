package repo

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"

	"go.uber.org/zap"
)

// RepoManager manages project-level bare repos, FlowRun-level integration refs,
// and NodeRun-level worktrees for Git repository caching optimization.
type RepoManager struct {
	baseDir      string                 // e.g. /var/lib/workgear/repos
	logger       *zap.SugaredLogger
	projectLocks map[string]*sync.Mutex // per-project lock (protects bare repo fetch + worktree add)
	flowLocks    map[string]*sync.Mutex // per-flow lock (protects integration commit)
	mu           sync.Mutex             // protects lock maps
}

// NewRepoManager creates a new RepoManager instance.
func NewRepoManager(baseDir string, logger *zap.SugaredLogger) *RepoManager {
	return &RepoManager{
		baseDir:      baseDir,
		logger:       logger,
		projectLocks: make(map[string]*sync.Mutex),
		flowLocks:    make(map[string]*sync.Mutex),
	}
}

// ─── Lock helpers ───

func (m *RepoManager) getProjectLock(projectID string) *sync.Mutex {
	m.mu.Lock()
	defer m.mu.Unlock()
	lock, ok := m.projectLocks[projectID]
	if !ok {
		lock = &sync.Mutex{}
		m.projectLocks[projectID] = lock
	}
	return lock
}

func (m *RepoManager) getFlowLock(flowRunID string) *sync.Mutex {
	m.mu.Lock()
	defer m.mu.Unlock()
	lock, ok := m.flowLocks[flowRunID]
	if !ok {
		lock = &sync.Mutex{}
		m.flowLocks[flowRunID] = lock
	}
	return lock
}

// cleanupFlowLock removes the flow lock entry (called when flow ends).
func (m *RepoManager) cleanupFlowLock(flowRunID string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	delete(m.flowLocks, flowRunID)
}

// ─── Path helpers ───

func (m *RepoManager) bareRepoPath(projectID string) string {
	return filepath.Join(m.baseDir, "project-"+projectID, "bare.git")
}

func (m *RepoManager) worktreePath(projectID, flowRunID, nodeRunID string) string {
	return filepath.Join(m.baseDir, "project-"+projectID, "worktrees", "flow-"+flowRunID, "node-"+nodeRunID)
}

func (m *RepoManager) flowWorktreeDir(projectID, flowRunID string) string {
	return filepath.Join(m.baseDir, "project-"+projectID, "worktrees", "flow-"+flowRunID)
}

// GetDepsPath returns the dependency cache path for a project (auto-creates directory).
func (m *RepoManager) GetDepsPath(projectID string) string {
	p := filepath.Join(m.baseDir, "project-"+projectID, "deps")
	os.MkdirAll(p, 0770)
	return p
}

// ─── Core operations ───

// EnsureBareRepo ensures the project's bare repo exists and is up-to-date.
// - Not exists: git clone --bare (first time, slow)
// - Exists: git fetch --all --prune (incremental, fast)
// Protected by per-project lock.
func (m *RepoManager) EnsureBareRepo(ctx context.Context, projectID, repoURL, accessToken string) (string, error) {
	lock := m.getProjectLock(projectID)
	lock.Lock()
	defer lock.Unlock()

	barePath := m.bareRepoPath(projectID)
	cloneURL := injectToken(repoURL, accessToken)
	safeURL := sanitizeURL(repoURL) // for logging

	if _, err := os.Stat(barePath); os.IsNotExist(err) {
		// First time: clone bare repo
		m.logger.Infow("Cloning bare repo", "project_id", projectID, "url", safeURL)

		if err := os.MkdirAll(filepath.Dir(barePath), 0770); err != nil {
			return "", fmt.Errorf("mkdir for bare repo: %w", err)
		}

		cmd := exec.CommandContext(ctx, "git", "clone", "--bare", cloneURL, barePath)
		if output, err := cmd.CombinedOutput(); err != nil {
			return "", fmt.Errorf("git clone --bare: %w\n%s", err, sanitizeOutput(output, accessToken))
		}

		m.logger.Infow("Bare repo cloned", "project_id", projectID, "path", barePath)
	} else {
		// Incremental update
		m.logger.Debugw("Fetching bare repo updates", "project_id", projectID)

		cmd := exec.CommandContext(ctx, "git", "-C", barePath, "fetch", "--all", "--prune")
		if output, err := cmd.CombinedOutput(); err != nil {
			m.logger.Warnw("git fetch failed, using stale repo",
				"project_id", projectID, "error", err, "output", sanitizeOutput(output, accessToken))
			// Non-fatal: continue with existing repo
		}
	}

	return barePath, nil
}

// EnsureFlowIntegration ensures the flow integration ref exists and returns the current head SHA.
// On first call for a flow, creates the integration ref pointing to the feature branch tip
// (or base branch if feature branch doesn't exist yet).
func (m *RepoManager) EnsureFlowIntegration(
	ctx context.Context,
	projectID, flowRunID, baseBranch, featureBranch string,
) (integrationRef string, headSHA string, err error) {
	lock := m.getProjectLock(projectID)
	lock.Lock()
	defer lock.Unlock()

	barePath := m.bareRepoPath(projectID)
	integrationRef = fmt.Sprintf("refs/flows/%s/integration", flowRunID)

	// Check if integration ref already exists
	cmd := exec.CommandContext(ctx, "git", "-C", barePath, "rev-parse", "--verify", integrationRef)
	if output, err := cmd.Output(); err == nil {
		headSHA = strings.TrimSpace(string(output))
		m.logger.Debugw("Integration ref exists", "flow_run_id", flowRunID, "head", headSHA[:12])
		return integrationRef, headSHA, nil
	}

	// Try feature branch first, then base branch
	for _, ref := range []string{"refs/heads/" + featureBranch, "origin/" + featureBranch, "refs/heads/" + baseBranch, "origin/" + baseBranch} {
		cmd = exec.CommandContext(ctx, "git", "-C", barePath, "rev-parse", "--verify", ref)
		if output, err := cmd.Output(); err == nil {
			headSHA = strings.TrimSpace(string(output))
			break
		}
	}

	if headSHA == "" {
		// Fallback: use HEAD
		cmd = exec.CommandContext(ctx, "git", "-C", barePath, "rev-parse", "HEAD")
		output, err := cmd.Output()
		if err != nil {
			return "", "", fmt.Errorf("cannot resolve any ref for integration base: %w", err)
		}
		headSHA = strings.TrimSpace(string(output))
	}

	// Create integration ref
	cmd = exec.CommandContext(ctx, "git", "-C", barePath, "update-ref", integrationRef, headSHA)
	if output, err := cmd.CombinedOutput(); err != nil {
		return "", "", fmt.Errorf("create integration ref: %w\n%s", err, output)
	}

	m.logger.Infow("Created integration ref", "flow_run_id", flowRunID, "ref", integrationRef, "head", headSHA[:12])
	return integrationRef, headSHA, nil
}

// EnsureNodeWorktree creates an independent worktree for a node run based on the given base SHA.
// If the worktree already exists, returns its path directly.
// Protected by per-project lock (worktree add writes to bare repo's worktrees dir).
func (m *RepoManager) EnsureNodeWorktree(
	ctx context.Context,
	projectID, flowRunID, nodeRunID, baseSHA string,
) (string, error) {
	lock := m.getProjectLock(projectID)
	lock.Lock()
	defer lock.Unlock()

	wtPath := m.worktreePath(projectID, flowRunID, nodeRunID)

	// Already exists
	if _, err := os.Stat(wtPath); err == nil {
		m.logger.Debugw("Node worktree already exists", "path", wtPath)
		return wtPath, nil
	}

	barePath := m.bareRepoPath(projectID)

	// Ensure parent directory exists
	if err := os.MkdirAll(filepath.Dir(wtPath), 0770); err != nil {
		return "", fmt.Errorf("mkdir for worktree: %w", err)
	}

	// Create worktree at detached HEAD pointing to baseSHA
	cmd := exec.CommandContext(ctx, "git", "-C", barePath, "worktree", "add", "--detach", wtPath, baseSHA)
	if output, err := cmd.CombinedOutput(); err != nil {
		return "", fmt.Errorf("git worktree add: %w\n%s", err, output)
	}

	// Configure git user inside worktree
	exec.CommandContext(ctx, "git", "-C", wtPath, "config", "user.email", "agent@workgear.dev").Run()
	exec.CommandContext(ctx, "git", "-C", wtPath, "config", "user.name", "WorkGear Agent").Run()

	m.logger.Infow("Created node worktree",
		"project_id", projectID, "flow_run_id", flowRunID,
		"node_run_id", nodeRunID, "base_sha", baseSHA[:12], "path", wtPath)

	return wtPath, nil
}

// IntegrateNodeCommit integrates a node's commit into the flow integration ref.
// Uses cherry-pick to apply the node's changes on top of the current integration head.
// Protected by per-flow lock (serializes integration across parallel nodes).
// Bare repo write operations also protected by per-project lock.
// Returns the new integration head SHA, or error if conflict occurs.
func (m *RepoManager) IntegrateNodeCommit(
	ctx context.Context,
	projectID, flowRunID, nodeRunID, commitSHA string,
) (string, error) {
	flowLock := m.getFlowLock(flowRunID)
	flowLock.Lock()
	defer flowLock.Unlock()

	barePath := m.bareRepoPath(projectID)
	integrationRef := fmt.Sprintf("refs/flows/%s/integration", flowRunID)

	// Get current integration head
	cmd := exec.CommandContext(ctx, "git", "-C", barePath, "rev-parse", "--verify", integrationRef)
	output, err := cmd.Output()
	if err != nil {
		return "", fmt.Errorf("resolve integration ref: %w", err)
	}
	currentHead := strings.TrimSpace(string(output))

	// Check if commit is already an ancestor (no-op)
	cmd = exec.CommandContext(ctx, "git", "-C", barePath, "merge-base", "--is-ancestor", commitSHA, currentHead)
	if cmd.Run() == nil {
		m.logger.Debugw("Node commit already integrated", "commit", commitSHA[:12], "head", currentHead[:12])
		return currentHead, nil
	}

	// Check if commit's parent is the current head (fast-forward possible)
	cmd = exec.CommandContext(ctx, "git", "-C", barePath, "merge-base", "--is-ancestor", currentHead, commitSHA)
	if cmd.Run() == nil {
		// Fast-forward: just update the ref (needs project lock for bare repo write)
		projectLock := m.getProjectLock(projectID)
		projectLock.Lock()
		cmd = exec.CommandContext(ctx, "git", "-C", barePath, "update-ref", integrationRef, commitSHA)
		if output, err := cmd.CombinedOutput(); err != nil {
			projectLock.Unlock()
			return "", fmt.Errorf("fast-forward integration ref: %w\n%s", err, output)
		}
		projectLock.Unlock()
		m.logger.Infow("Fast-forward integration",
			"flow_run_id", flowRunID, "node_run_id", nodeRunID,
			"old_head", currentHead[:12], "new_head", commitSHA[:12])
		return commitSHA, nil
	}

	// Need cherry-pick: create a temporary worktree for integration
	// Worktree operations need project lock
	projectLock := m.getProjectLock(projectID)
	projectLock.Lock()
	defer projectLock.Unlock()

	integrationWT := filepath.Join(m.baseDir, "project-"+projectID, "worktrees", "flow-"+flowRunID, "_integration")
	defer func() {
		// Cleanup integration worktree
		exec.CommandContext(ctx, "git", "-C", barePath, "worktree", "remove", "--force", integrationWT).Run()
		os.RemoveAll(integrationWT)
	}()

	// Create integration worktree at current head
	os.MkdirAll(filepath.Dir(integrationWT), 0770)
	cmd = exec.CommandContext(ctx, "git", "-C", barePath, "worktree", "add", "--detach", integrationWT, currentHead)
	if output, err := cmd.CombinedOutput(); err != nil {
		return "", fmt.Errorf("create integration worktree: %w\n%s", err, output)
	}

	// Configure git user
	exec.CommandContext(ctx, "git", "-C", integrationWT, "config", "user.email", "agent@workgear.dev").Run()
	exec.CommandContext(ctx, "git", "-C", integrationWT, "config", "user.name", "WorkGear Agent").Run()

	// Cherry-pick the node commit
	cmd = exec.CommandContext(ctx, "git", "-C", integrationWT, "cherry-pick", commitSHA)
	if output, err := cmd.CombinedOutput(); err != nil {
		// Cherry-pick failed — likely conflict
		exec.CommandContext(ctx, "git", "-C", integrationWT, "cherry-pick", "--abort").Run()
		return "", fmt.Errorf("cherry-pick conflict for node %s: %w\n%s", nodeRunID, err, output)
	}

	// Get new head SHA
	cmd = exec.CommandContext(ctx, "git", "-C", integrationWT, "rev-parse", "HEAD")
	output, err = cmd.Output()
	if err != nil {
		return "", fmt.Errorf("get new head after cherry-pick: %w", err)
	}
	newHead := strings.TrimSpace(string(output))

	// Update integration ref
	cmd = exec.CommandContext(ctx, "git", "-C", barePath, "update-ref", integrationRef, newHead)
	if output, err := cmd.CombinedOutput(); err != nil {
		return "", fmt.Errorf("update integration ref: %w\n%s", err, output)
	}

	m.logger.Infow("Integrated node commit via cherry-pick",
		"flow_run_id", flowRunID, "node_run_id", nodeRunID,
		"commit", commitSHA[:12], "old_head", currentHead[:12], "new_head", newHead[:12])

	return newHead, nil
}

// PushIntegration pushes the integration ref to the remote feature branch.
func (m *RepoManager) PushIntegration(
	ctx context.Context,
	projectID, flowRunID, repoURL, accessToken, featureBranch string,
) error {
	barePath := m.bareRepoPath(projectID)
	integrationRef := fmt.Sprintf("refs/flows/%s/integration", flowRunID)
	cloneURL := injectToken(repoURL, accessToken)

	cmd := exec.CommandContext(ctx, "git", "-C", barePath,
		"push", cloneURL, integrationRef+":refs/heads/"+featureBranch, "--force")
	if output, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("push integration to %s: %w\n%s", featureBranch, err, sanitizeOutput(output, accessToken))
	}

	m.logger.Infow("Pushed integration to remote",
		"flow_run_id", flowRunID, "branch", featureBranch)
	return nil
}

// ─── Cleanup ───

// CleanupNodeWorktree removes a single node's worktree.
func (m *RepoManager) CleanupNodeWorktree(ctx context.Context, projectID, flowRunID, nodeRunID string) error {
	barePath := m.bareRepoPath(projectID)
	wtPath := m.worktreePath(projectID, flowRunID, nodeRunID)

	cmd := exec.CommandContext(ctx, "git", "-C", barePath, "worktree", "remove", "--force", wtPath)
	if output, err := cmd.CombinedOutput(); err != nil {
		m.logger.Warnw("Failed to git worktree remove, falling back to rm",
			"path", wtPath, "error", err, "output", string(output))
		os.RemoveAll(wtPath)
	}

	m.logger.Debugw("Cleaned up node worktree", "path", wtPath)
	return nil
}

// CleanupFlowState cleans up all flow-level state: node worktrees + integration ref.
func (m *RepoManager) CleanupFlowState(ctx context.Context, projectID, flowRunID string) error {
	barePath := m.bareRepoPath(projectID)

	// 1. Prune worktrees (handles stale entries)
	exec.CommandContext(ctx, "git", "-C", barePath, "worktree", "prune").Run()

	// 2. Remove flow worktree directory
	flowDir := m.flowWorktreeDir(projectID, flowRunID)
	if err := os.RemoveAll(flowDir); err != nil {
		m.logger.Warnw("Failed to remove flow worktree dir", "path", flowDir, "error", err)
	}

	// 3. Delete integration ref
	integrationRef := fmt.Sprintf("refs/flows/%s/integration", flowRunID)
	exec.CommandContext(ctx, "git", "-C", barePath, "update-ref", "-d", integrationRef).Run()

	// 4. Cleanup flow lock
	m.cleanupFlowLock(flowRunID)

	m.logger.Infow("Cleaned up flow state", "project_id", projectID, "flow_run_id", flowRunID)
	return nil
}

// CleanupProject removes all cached data for a project.
func (m *RepoManager) CleanupProject(ctx context.Context, projectID string) error {
	projectDir := filepath.Join(m.baseDir, "project-"+projectID)
	if err := os.RemoveAll(projectDir); err != nil {
		return fmt.Errorf("remove project dir: %w", err)
	}
	m.logger.Infow("Cleaned up project cache", "project_id", projectID)
	return nil
}

// ─── Helpers ───

// injectToken inserts an access token into an HTTPS URL.
func injectToken(repoURL, token string) string {
	if token == "" {
		return repoURL
	}
	const prefix = "https://"
	if !strings.HasPrefix(strings.ToLower(repoURL), prefix) {
		return repoURL
	}
	rest := repoURL[len(prefix):]
	// Strip existing credentials if present
	if atIdx := strings.Index(rest, "@"); atIdx >= 0 {
		slashIdx := strings.Index(rest, "/")
		if slashIdx < 0 || atIdx < slashIdx {
			rest = rest[atIdx+1:]
		}
	}
	return prefix + token + "@" + rest
}

// sanitizeURL removes credentials from a URL for safe logging.
func sanitizeURL(url string) string {
	const prefix = "https://"
	if !strings.HasPrefix(strings.ToLower(url), prefix) {
		return url
	}
	rest := url[len(prefix):]
	if atIdx := strings.Index(rest, "@"); atIdx >= 0 {
		slashIdx := strings.Index(rest, "/")
		if slashIdx < 0 || atIdx < slashIdx {
			return prefix + "***@" + rest[atIdx+1:]
		}
	}
	return url
}

// sanitizeOutput removes token from command output for safe logging.
func sanitizeOutput(output []byte, token string) string {
	s := string(output)
	if token != "" {
		s = strings.ReplaceAll(s, token, "***")
	}
	return s
}
