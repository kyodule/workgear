# WorkGear Agent - Factory Droid Docker Image

This Docker image provides a containerized Factory Droid agent for WorkGear workflow execution.

## Building the Image

```bash
cd docker/agent-droid
docker build -t workgear/agent-droid:latest .
```

## Environment Variables

### Authentication (one of the following)

| Variable | Description |
|----------|-------------|
| `FACTORY_API_KEY` | Factory platform API key (uses built-in models) |
| `DROID_PROVIDER_TYPE` + `DROID_BASE_URL` + `DROID_API_KEY` | BYOK: use your own LLM provider |

### Required Variables

| Variable | Description |
|----------|-------------|
| `AGENT_PROMPT` | The prompt to send to Droid |
| `AGENT_MODE` | Execution mode: `spec`, `execute`, `review`, `test`, `opsx_plan`, or `opsx_apply` |

### BYOK Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `DROID_PROVIDER_TYPE` | - | Provider type: `anthropic`, `openai`, or `generic-chat-completion-api` |
| `DROID_BASE_URL` | - | Provider API base URL (e.g., `https://api.anthropic.com`) |
| `DROID_API_KEY` | - | Provider API key |
| `DROID_MODEL` | - | Model ID (e.g., `claude-sonnet-4-5-20250929`) |
| `DROID_MODEL_DISPLAY_NAME` | `Custom Model (BYOK)` | Display name for the custom model |
| `DROID_MAX_OUTPUT_TOKENS` | `16384` | Max output tokens for the custom model |

### Git Workflow Variables

| Variable | Description |
|----------|-------------|
| `GIT_REPO_URL` | Git repository URL to clone |
| `GIT_BRANCH` | Base branch to clone from (default: `main`) |
| `GIT_BASE_BRANCH` | Base branch for PR target (default: `main`) |
| `GIT_FEATURE_BRANCH` | Feature branch to push to (default: same as `GIT_BRANCH`) |
| `GIT_CREATE_PR` | Set to `"true"` to create GitHub PR after push |
| `GIT_PR_TITLE` | PR title (used when `GIT_CREATE_PR=true`) |
| `GIT_ACCESS_TOKEN` | GitHub access token for PR creation |

### OpenSpec Variables

| Variable | Description |
|----------|-------------|
| `OPSX_INIT_IF_MISSING` | Initialize OpenSpec if not present (default: `false`) |
| `OPSX_CHANGE_NAME` | OpenSpec change name for commit messages |
| `OPSX_ACTION` | OpenSpec action (e.g., `archive`) |

### Other Variables

| Variable | Description |
|----------|-------------|
| `TASK_ID` | Task ID for logging |
| `NODE_ID` | Node ID for logging |

## Usage

### Test Mode (Quick Validation)

```bash
docker run --rm \
  -e FACTORY_API_KEY="fk-..." \
  -e AGENT_MODE="test" \
  workgear/agent-droid:latest
```

### Spec Mode (Read-Only Analysis)

```bash
docker run --rm \
  -e FACTORY_API_KEY="fk-..." \
  -e AGENT_PROMPT="Analyze this codebase and suggest improvements" \
  -e AGENT_MODE="spec" \
  -e GIT_REPO_URL="https://github.com/user/repo.git" \
  -e GIT_BRANCH="main" \
  workgear/agent-droid:latest
```

### Execute Mode (Make Changes)

```bash
docker run --rm \
  -e FACTORY_API_KEY="fk-..." \
  -e AGENT_PROMPT="Fix the login bug" \
  -e AGENT_MODE="execute" \
  -e GIT_REPO_URL="https://token@github.com/user/repo.git" \
  -e GIT_BASE_BRANCH="main" \
  -e GIT_FEATURE_BRANCH="agent/fix-login-bug" \
  -e GIT_CREATE_PR="true" \
  -e GIT_PR_TITLE="[Agent] Fix login bug" \
  -e GIT_ACCESS_TOKEN="ghp_xxx" \
  workgear/agent-droid:latest
```

### BYOK Mode (Bring Your Own Key)

```bash
docker run --rm \
  -e DROID_PROVIDER_TYPE="anthropic" \
  -e DROID_BASE_URL="https://api.anthropic.com" \
  -e DROID_API_KEY="sk-ant-xxx" \
  -e DROID_MODEL="claude-sonnet-4-5-20250929" \
  -e AGENT_PROMPT="Analyze this codebase" \
  -e AGENT_MODE="spec" \
  -e GIT_REPO_URL="https://github.com/user/repo.git" \
  workgear/agent-droid:latest
```

This generates `~/.factory/settings.json` inside the container:

```json
{
  "customModels": [
    {
      "model": "claude-sonnet-4-5-20250929",
      "displayName": "Custom Model (BYOK)",
      "baseUrl": "https://api.anthropic.com",
      "apiKey": "sk-ant-xxx",
      "provider": "anthropic",
      "maxOutputTokens": 16384
    }
  ]
}
```

## Execution Flow

1. **Generate Configuration**
   - BYOK mode: creates `~/.factory/settings.json` with custom model config
   - Factory mode: uses `FACTORY_API_KEY` for built-in model access

2. **Clone Repository** (if `GIT_REPO_URL` is set)
   - Clones the specified base branch
   - Configures git user for commits

3. **Run Droid CLI**
   - Executes `droid exec` with appropriate `--auto` level based on `AGENT_MODE`
   - Uses `--output-format stream-json --verbose` for real-time log streaming
   - Captures output to `/output/result.json`

4. **Commit & Push** (if `AGENT_MODE=execute|opsx_plan|opsx_apply`)
   - Creates and switches to feature branch
   - Stages all changes
   - Commits with auto-generated message
   - Pushes to the feature branch

5. **Create PR** (if `GIT_CREATE_PR=true`)
   - Calls GitHub API to create pull request
   - Feature branch → Base branch
   - Idempotent (ignores 422 if PR already exists)
   - Writes PR URL to `/output/pr_url.txt`

6. **Output Result**
   - Prints JSON result to stdout
   - Orchestrator parses this output

## Agent Modes

| Mode | Droid Exec Args | Description |
|------|----------------|-------------|
| `test` | `--auto low` | Quick validation with simple test prompt |
| `spec` | *(default, read-only)* | Analysis and planning without making changes |
| `review` | `--auto low` | Code review with limited autonomy |
| `execute` | `--auto high --skip-permissions-unsafe` | Make changes and commit to git |
| `opsx_plan` | `--auto high --skip-permissions-unsafe` | Generate OpenSpec artifacts |
| `opsx_apply` | `--auto high --skip-permissions-unsafe` | Implement OpenSpec tasks |

## Output Format

The container outputs JSON to stdout (stream-json result event from Droid CLI).

Git metadata is written to `/output/git_metadata.json`:

```json
{
  "branch": "agent/fix-bug",
  "base_branch": "main",
  "commit": "abc123...",
  "commit_message": "agent: auto-commit from workflow",
  "pr_url": "https://github.com/user/repo/pull/42",
  "pr_number": 42,
  "changed_files": ["src/file1.ts", "src/file2.ts"],
  "repo_url": "https://github.com/user/repo",
  "changed_files_detail": [
    {"path": "src/file1.ts", "status": "modified"},
    {"path": "src/file2.ts", "status": "added"}
  ]
}
```

## Troubleshooting

### Container exits with code 1
- Check `FACTORY_API_KEY` is valid (or BYOK config is correct)
- Check Droid CLI is installed correctly
- Review stderr logs

### Git clone fails
- Verify repository URL is correct
- Check authentication (token)
- Ensure branch exists

### PR creation fails
- Verify `GIT_ACCESS_TOKEN` has `repo` scope
- Check repository URL is a valid GitHub URL
- Review GitHub API error in logs

### BYOK not working
- Verify `DROID_PROVIDER_TYPE` is one of: `anthropic`, `openai`, `generic-chat-completion-api`
- Check `DROID_BASE_URL` and `DROID_API_KEY` are correct
- Ensure the model ID matches your provider's supported models

## References

- [Factory Droid CLI Quickstart](https://docs.factory.ai/cli/getting-started/quickstart)
- [Factory BYOK Configuration](https://docs.factory.ai/cli/byok/overview)
- [Droid Exec (Headless)](https://docs.factory.ai/cli/droid-exec/overview)

## Development

To test the entrypoint script locally:
```bash
chmod +x entrypoint.sh
FACTORY_API_KEY=xxx \
AGENT_PROMPT="test" \
AGENT_MODE=test \
./entrypoint.sh
```
