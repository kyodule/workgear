package agent

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"strconv"
	"time"
)

// DroidAdapter is a TypeAdapter for Factory Droid CLI
type DroidAdapter struct {
	promptBuilder *PromptBuilder
	providerID    string
	providerType  string // "anthropic" | "openai" | "generic-chat-completion-api"
	apiKey        string
	baseURL       string
	model         string
	image         string
	config        map[string]any // full provider config for extra BYOK fields
}

// NewDroidAdapter creates a new Droid adapter with provider-level config
func NewDroidAdapter(promptBuilder *PromptBuilder, providerID, providerType, apiKey, baseURL, model string) *DroidAdapter {
	image := os.Getenv("DROID_DOCKER_IMAGE")
	if image == "" {
		image = "workgear/agent-droid:latest"
	}
	return &DroidAdapter{
		promptBuilder: promptBuilder,
		providerID:    providerID,
		providerType:  providerType,
		apiKey:        apiKey,
		baseURL:       baseURL,
		model:         model,
		image:         image,
	}
}

func (a *DroidAdapter) Name() string { return "droid" }

func (a *DroidAdapter) BuildRequest(ctx context.Context, req *AgentRequest) (*ExecutorRequest, error) {
	// Build full prompt
	prompt := a.promptBuilder.Build(req)

	// Prepare environment variables
	env := map[string]string{
		"AGENT_PROMPT": prompt,
		"AGENT_MODE":   req.Mode,
		"TASK_ID":      req.TaskID,
		"NODE_ID":      req.NodeID,
	}

	// Authentication: BYOK mode via settings.json
	if a.providerType != "" && a.baseURL != "" && a.apiKey != "" {
		env["DROID_PROVIDER_TYPE"] = a.providerType
		env["DROID_BASE_URL"] = a.baseURL
		env["DROID_API_KEY"] = a.apiKey

		// Optional BYOK fields from provider config
		if modelID, ok := a.config["model_id"].(string); ok && modelID != "" {
			env["DROID_MODEL"] = modelID
		}
		if displayName, ok := a.config["display_name"].(string); ok && displayName != "" {
			env["DROID_MODEL_DISPLAY_NAME"] = displayName
		}
		if maxTokens, ok := a.config["max_output_tokens"].(string); ok && maxTokens != "" {
			env["DROID_MAX_OUTPUT_TOKENS"] = maxTokens
		}
	}

	// Model selection: req.Model (highest priority) > a.model (global default)
	model := req.Model
	if model == "" {
		model = a.model
	}
	if model != "" {
		env["DROID_MODEL"] = model
	}

	// Git configuration
	if req.GitRepoURL != "" {
		env["GIT_REPO_URL"] = req.GitRepoURL
	}

	baseBranch := req.GitBranch
	if baseBranch == "" {
		baseBranch = "main"
	}
	env["GIT_BRANCH"] = baseBranch
	env["GIT_BASE_BRANCH"] = baseBranch

	featureBranch := req.GitBranch
	if featureBranch == "" || featureBranch == "main" {
		if req.OpsxConfig != nil && req.OpsxConfig.ChangeName != "" {
			featureBranch = "agent/" + req.OpsxConfig.ChangeName
		} else {
			featureBranch = generateFeatureBranch(req.TaskTitle, "")
		}
	}
	env["GIT_FEATURE_BRANCH"] = featureBranch

	env["GIT_CREATE_PR"] = "true"
	env["GIT_PR_TITLE"] = req.TaskTitle

	if req.GitAccessToken != "" {
		env["GIT_ACCESS_TOKEN"] = req.GitAccessToken
	}

	// Skip Git for generate_change_name mode
	if req.Mode == "generate_change_name" {
		env["GIT_REPO_URL"] = ""
		env["GIT_CREATE_PR"] = "false"
	}

	// OpenSpec configuration
	if req.Mode == "opsx_plan" || req.Mode == "opsx_apply" {
		if opsx := req.OpsxConfig; opsx != nil {
			env["OPSX_CHANGE_NAME"] = opsx.ChangeName
			if opsx.Schema != "" {
				env["OPSX_SCHEMA"] = opsx.Schema
			}
			env["OPSX_INIT_IF_MISSING"] = strconv.FormatBool(opsx.InitIfMissing)
			if opsx.Action != "" {
				env["OPSX_ACTION"] = opsx.Action
			}
		}
	}

	return &ExecutorRequest{
		Image:   a.image,
		Command: nil,
		Env:     env,
		WorkDir: "/workspace",
		Timeout: 10 * time.Minute,
	}, nil
}

func (a *DroidAdapter) ParseResponse(resp *ExecutorResponse) (*AgentResponse, error) {
	if resp.ExitCode != 0 {
		return nil, fmt.Errorf("droid execution failed (exit code %d): %s", resp.ExitCode, resp.Stderr)
	}

	// Droid outputs stream-json; the last "result" event is captured by entrypoint.sh
	// The format is compatible with Claude CLI stream-json output
	var claudeOutput ClaudeOutput
	if err := json.Unmarshal([]byte(resp.Stdout), &claudeOutput); err != nil {
		// If not valid JSON, wrap the raw output
		return &AgentResponse{
			Output: map[string]any{
				"result":  resp.Stdout,
				"raw":     true,
				"summary": "Droid execution completed (non-JSON output)",
			},
			GitMetadata: resp.GitMetadata,
		}, nil
	}

	// Convert to AgentResponse (reuse ClaudeOutput structure since Droid stream-json is compatible)
	output := make(map[string]any)
	if claudeOutput.Result != nil {
		output = claudeOutput.Result
	}
	if claudeOutput.Summary != "" {
		output["summary"] = claudeOutput.Summary
	}
	if len(claudeOutput.ChangedFiles) > 0 {
		output["changed_files"] = claudeOutput.ChangedFiles
	}
	if claudeOutput.Plan != "" {
		output["plan"] = claudeOutput.Plan
	}
	if claudeOutput.Report != "" {
		output["report"] = claudeOutput.Report
	}
	if claudeOutput.Passed != nil {
		output["passed"] = *claudeOutput.Passed
	}
	if len(claudeOutput.Issues) > 0 {
		output["issues"] = claudeOutput.Issues
	}

	metrics := &ExecutionMetrics{
		TokenInput:  claudeOutput.TokensIn,
		TokenOutput: claudeOutput.TokensOut,
		DurationMs:  claudeOutput.DurationMs,
	}

	return &AgentResponse{
		Output:      output,
		Metrics:     metrics,
		GitMetadata: resp.GitMetadata,
	}, nil
}
