#!/bin/bash
set -e

# ─── Output Convention ───
# All log messages go to stderr (for debugging)
# Only the final JSON result goes to stdout (for structured parsing)
# Git metadata is written to /output/git_metadata.json

# Save original stdout (fd 3), then redirect stdout to stderr
# so all echo statements go to stderr by default
exec 3>&1 1>&2

# ─── Configuration ───
WORKSPACE="/workspace"
RESULT_FILE="/output/result.json"
GIT_METADATA_FILE="/output/git_metadata.json"
FACTORY_CONFIG_DIR="/home/agent/.factory"
FACTORY_SETTINGS_FILE="$FACTORY_CONFIG_DIR/settings.json"

# Initialize git metadata as empty
echo '{}' > "$GIT_METADATA_FILE"

echo "[agent] Starting Droid agent..."
echo "[agent] Mode: ${AGENT_MODE:-execute}"
echo "[agent] Git repo: ${GIT_REPO_URL:-none}"
echo "[agent] Git branch: ${GIT_BRANCH:-main}"

# ─── Step 0: Generate Factory Droid config files ───
echo "[agent] Generating Droid configuration..."

# Generate settings.json for BYOK (custom model) if provider config is set
if [ -n "$DROID_PROVIDER_TYPE" ] && [ -n "$DROID_BASE_URL" ] && [ -n "$DROID_API_KEY" ]; then
    echo "[agent] BYOK mode: configuring custom model via settings.json"

    # Determine model ID
    BYOK_MODEL="${DROID_MODEL:-custom-model}"
    BYOK_DISPLAY_NAME="${DROID_MODEL_DISPLAY_NAME:-Custom Model (BYOK)}"
    BYOK_MAX_OUTPUT_TOKENS="${DROID_MAX_OUTPUT_TOKENS:-16384}"

    cat > "$FACTORY_SETTINGS_FILE" <<EOF
{
  "customModels": [
    {
      "model": "${BYOK_MODEL}",
      "displayName": "${BYOK_DISPLAY_NAME}",
      "baseUrl": "${DROID_BASE_URL}",
      "apiKey": "${DROID_API_KEY}",
      "provider": "${DROID_PROVIDER_TYPE}",
      "maxOutputTokens": ${BYOK_MAX_OUTPUT_TOKENS}
    }
  ]
}
EOF
    echo "[agent] BYOK settings.json created (provider: ${DROID_PROVIDER_TYPE}, model: ${BYOK_MODEL})"
    # ACP 模式只需非空 FACTORY_API_KEY 绕过 CLI 登录检查
    export FACTORY_API_KEY="byok-acp"
    # 构造 ACP 模型 ID: custom:DisplayName-Index (空格替换为 -)
    ACP_MODEL_ID="custom:$(echo "$BYOK_DISPLAY_NAME" | tr ' ' '-')-0"
    echo "[agent] ACP model ID: $ACP_MODEL_ID"
elif [ -n "$FACTORY_API_KEY" ]; then
    echo "[agent] Factory platform mode: using FACTORY_API_KEY"
else
    echo "[agent] Warning: No FACTORY_API_KEY or BYOK config set"
fi

echo "[agent] Configuration files created"

# ─── Git identity (always configure) ───
git config --global user.email "agent@workgear.dev"
git config --global user.name "WorkGear Agent"

# ─── Step 1: Clone repository (if configured) ───
if [ -n "$GIT_REPO_URL" ]; then
    echo "[agent] Cloning repository..."
    BRANCH="${GIT_BRANCH:-main}"

    # Clone
    git clone "$GIT_REPO_URL" --branch "$BRANCH" --single-branch --depth 50 "$WORKSPACE" 2>&1 || {
        echo "[agent] Failed to clone branch $BRANCH, trying default branch..."
        git clone "$GIT_REPO_URL" --single-branch --depth 50 "$WORKSPACE" 2>&1
        cd "$WORKSPACE"
        git checkout -b "$BRANCH"
    }
    cd "$WORKSPACE"
    echo "[agent] Repository cloned successfully."
else
    echo "[agent] No GIT_REPO_URL configured, working in empty workspace."
    cd "$WORKSPACE"
fi

# ─── Step 1.5: Initialize OpenSpec (if needed) ───
if [ "$AGENT_MODE" = "opsx_plan" ] || [ "$AGENT_MODE" = "opsx_apply" ]; then
    echo "[agent] OpenSpec mode detected: $AGENT_MODE"
    if [ ! -d "openspec" ] && [ "$OPSX_INIT_IF_MISSING" = "true" ]; then
        echo "[agent] Initializing OpenSpec..."
        openspec init --tools none --force 2>&1 || {
            echo "[agent] Warning: openspec init failed, continuing anyway..."
        }
    fi
fi

# ─── Step 2: Run Droid CLI via ACP Protocol ───
echo "[agent] Running droid CLI via ACP protocol..."

# Handle test mode defaults
if [ "$AGENT_MODE" = "test" ]; then
    echo "[agent] Test mode: running simple validation..."
    if [ -z "$AGENT_PROMPT" ] || [ "$AGENT_PROMPT" = "" ]; then
        AGENT_PROMPT="Echo 'Droid agent test successful' and exit immediately"
    fi
    # Ensure workspace is a git repo (droid may require it)
    if [ ! -d "$WORKSPACE/.git" ]; then
        cd "$WORKSPACE"
        git init
        git commit --allow-empty -m "init"
    fi
fi

# Map AGENT_MODE to ACP mode ID
case "$AGENT_MODE" in
    spec)       ACP_MODE="normal" ;;
    review)     ACP_MODE="auto-low" ;;
    test)       ACP_MODE="auto-low" ;;
    execute|opsx_plan|opsx_apply)
                ACP_MODE="auto-high" ;;
    *)          ACP_MODE="auto-high" ;;
esac
echo "[agent] ACP mode: $ACP_MODE"

# ─── ACP Communication Setup ───
# Use two FIFOs for bidirectional communication with droid ACP process
ACP_IN="/tmp/acp_in"    # entrypoint writes → droid reads
ACP_OUT="/tmp/acp_out"  # droid writes → entrypoint reads
rm -f "$ACP_IN" "$ACP_OUT"
mkfifo "$ACP_IN" "$ACP_OUT"

# Emit pseudo stream-json start event (compatible with executor.go streamLogs parser)
echo "{\"type\":\"assistant\",\"message\":{\"role\":\"assistant\",\"content\":[{\"type\":\"text\",\"text\":\"开始执行 Droid Agent（模式: ${AGENT_MODE:-execute}）...\"}]},\"timestamp\":$(date +%s%3N)}" >&2

# Launch droid exec in ACP mode with FIFOs
droid exec --output-format acp --skip-permissions-unsafe < "$ACP_IN" > "$ACP_OUT" 2>/tmp/droid_stderr.log &
DROID_PID=$!

# Open write end of input FIFO (keep it open so droid doesn't get EOF)
exec 4>"$ACP_IN"
# Open read end of output FIFO
exec 5<"$ACP_OUT"

sleep 1

# Verify droid process started
if ! kill -0 $DROID_PID 2>/dev/null; then
    echo "[agent] Failed to start droid ACP process"
    cat /tmp/droid_stderr.log 2>/dev/null
    echo "{\"error\": \"Failed to start droid ACP process\"}" >&3
    exit 1
fi

ACP_MSG_ID=0
ACP_RESPONSE_TEXT=""
ACP_SESSION_ID=""

# Send an ACP message via fd 4
acp_send() {
    local method="$1"
    local params="$2"
    ACP_MSG_ID=$((ACP_MSG_ID + 1))
    echo "[agent] ACP >> $method (id=$ACP_MSG_ID)"
    echo "{\"jsonrpc\":\"2.0\",\"method\":\"$method\",\"params\":$params,\"id\":\"$ACP_MSG_ID\"}" >&4
}

# Read ACP responses from fd 5 until we get the response for expected_id
# Collects agent_message_chunk text into ACP_RESPONSE_TEXT
# Sets ACP_LAST_RESPONSE to the matched response line
# Returns 0 on success, 1 on timeout, 2 on ACP error
acp_wait_response() {
    local expected_id="$1"
    local timeout_sec="${2:-30}"
    ACP_LAST_RESPONSE=""

    while IFS= read -r -t "$timeout_sec" line <&5; do
        [ -z "$line" ] && continue
        # Forward to stderr for Docker log streaming
        echo "$line" >&2

        local msg_id=$(echo "$line" | jq -r '.id // empty' 2>/dev/null)
        local msg_method=$(echo "$line" | jq -r '.method // empty' 2>/dev/null)

        # Handle session/update notifications
        if [ "$msg_method" = "session/update" ]; then
            local update_type=$(echo "$line" | jq -r '.params.update.sessionUpdate // empty' 2>/dev/null)
            if [ "$update_type" = "agent_message_chunk" ]; then
                local chunk=$(echo "$line" | jq -r '.params.update.content.text // empty' 2>/dev/null)
                ACP_RESPONSE_TEXT="${ACP_RESPONSE_TEXT}${chunk}"
            fi
            continue
        fi

        # Check if this is the response we're waiting for
        if [ "$msg_id" = "$expected_id" ]; then
            ACP_LAST_RESPONSE="$line"
            local has_error=$(echo "$line" | jq -r 'if .error then "yes" else "" end' 2>/dev/null)
            if [ "$has_error" = "yes" ]; then
                local err_msg=$(echo "$line" | jq -r '.error.message // "unknown error"' 2>/dev/null)
                echo "[agent] ACP error (id=$expected_id): $err_msg"
                return 2
            fi
            return 0
        fi
    done

    echo "[agent] ACP timeout waiting for response id=$expected_id"
    return 1
}

ACP_FAILED=false

# Step 2a: Initialize
acp_send "initialize" '{"protocolVersion":1}'
if ! acp_wait_response "$ACP_MSG_ID" 10; then
    echo "[agent] ACP initialize failed"
    ACP_FAILED=true
fi

# Step 2b: Authenticate
if [ "$ACP_FAILED" = "false" ]; then
    acp_send "authenticate" '{"methodId":"factory-api-key"}'
    if ! acp_wait_response "$ACP_MSG_ID" 10; then
        echo "[agent] ACP authenticate failed"
        ACP_FAILED=true
    fi
fi

# Step 2c: Create session
if [ "$ACP_FAILED" = "false" ]; then
    acp_send "session/new" "{\"cwd\":\"$WORKSPACE\",\"mcpServers\":[]}"
    if ! acp_wait_response "$ACP_MSG_ID" 15; then
        echo "[agent] ACP session/new failed"
        ACP_FAILED=true
    else
        ACP_SESSION_ID=$(echo "$ACP_LAST_RESPONSE" | jq -r '.result.sessionId // empty' 2>/dev/null)
        echo "[agent] ACP session created: $ACP_SESSION_ID"
    fi
fi

# Step 2d: Set model (BYOK only)
if [ "$ACP_FAILED" = "false" ] && [ -n "$ACP_MODEL_ID" ]; then
    echo "[agent] Setting model to: $ACP_MODEL_ID"
    acp_send "session/set_model" "{\"sessionId\":\"$ACP_SESSION_ID\",\"modelId\":\"$ACP_MODEL_ID\"}"
    if ! acp_wait_response "$ACP_MSG_ID" 10; then
        echo "[agent] ACP session/set_model failed (non-fatal, using default model)"
    fi
fi

# Step 2e: Set mode
if [ "$ACP_FAILED" = "false" ]; then
    echo "[agent] Setting mode to: $ACP_MODE"
    acp_send "session/set_mode" "{\"sessionId\":\"$ACP_SESSION_ID\",\"modeId\":\"$ACP_MODE\"}"
    if ! acp_wait_response "$ACP_MSG_ID" 10; then
        echo "[agent] ACP session/set_mode failed (non-fatal)"
    fi
fi

# Step 2f: Send prompt and collect response
if [ "$ACP_FAILED" = "false" ]; then
    ESCAPED_PROMPT=$(echo "$AGENT_PROMPT" | jq -Rs '.')
    acp_send "session/prompt" "{\"sessionId\":\"$ACP_SESSION_ID\",\"prompt\":[{\"type\":\"text\",\"text\":$ESCAPED_PROMPT}]}"

    PROMPT_TIMEOUT="${DROID_TIMEOUT:-600}"
    if ! acp_wait_response "$ACP_MSG_ID" "$PROMPT_TIMEOUT"; then
        echo "[agent] ACP session/prompt failed or timed out"
        ACP_FAILED=true
    else
        STOP_REASON=$(echo "$ACP_LAST_RESPONSE" | jq -r '.result.stopReason // "unknown"' 2>/dev/null)
        echo "[agent] ACP prompt completed, stopReason: $STOP_REASON"
    fi
fi

# Cleanup: close FDs and kill droid process
exec 4>&- 2>/dev/null
exec 5<&- 2>/dev/null
kill $DROID_PID 2>/dev/null
wait $DROID_PID 2>/dev/null || true
rm -f "$ACP_IN" "$ACP_OUT"

# Build result
if [ "$ACP_FAILED" = "true" ]; then
    echo "{\"type\":\"result\",\"subtype\":\"error\",\"timestamp\":$(date +%s%3N)}" >&2
    ERROR_MSG=$(echo "$ACP_LAST_RESPONSE" | jq -r '.error.message // "ACP execution failed"' 2>/dev/null)
    echo "{\"error\": \"$ERROR_MSG\"}" > "$RESULT_FILE"
else
    echo "{\"type\":\"result\",\"subtype\":\"success\",\"timestamp\":$(date +%s%3N)}" >&2
    jq -n \
        --arg result "$ACP_RESPONSE_TEXT" \
        --arg stop_reason "${STOP_REASON:-end_turn}" \
        --arg session_id "$ACP_SESSION_ID" \
        '{
            type: "result",
            subtype: "success",
            result: $result,
            stop_reason: $stop_reason,
            session_id: $session_id
        }' > "$RESULT_FILE"
fi

# Verify we got a result
if [ ! -f "$RESULT_FILE" ] || [ ! -s "$RESULT_FILE" ]; then
    echo "[agent] Warning: No result file or empty result from Droid CLI"
    echo '{"error": "No result", "summary": "Agent execution completed but no result was produced."}' > "$RESULT_FILE"
fi

echo "[agent] Droid CLI completed successfully."

# ─── Helper: Create GitHub PR ───
create_github_pr() {
    local FEATURE_BRANCH="$1"
    local BASE_BRANCH="$2"
    local PR_TITLE="$3"
    local PR_BODY="$4"

    echo "[agent] Creating GitHub PR: $FEATURE_BRANCH -> $BASE_BRANCH"

    # Extract owner/repo from GIT_REPO_URL
    local REPO_PATH=$(echo "$GIT_REPO_URL" | sed -E 's|^https?://([^@]*@)?github\.com[/:]||' | sed 's|\.git$||')
    local OWNER=$(echo "$REPO_PATH" | cut -d'/' -f1)
    local REPO=$(echo "$REPO_PATH" | cut -d'/' -f2)

    if [ -z "$OWNER" ] || [ -z "$REPO" ]; then
        echo "[agent] Warning: Could not parse owner/repo from $GIT_REPO_URL, skipping PR creation"
        return 0
    fi

    # Extract token from URL or use GIT_ACCESS_TOKEN
    local TOKEN=""
    if [ -n "$GIT_ACCESS_TOKEN" ]; then
        TOKEN="$GIT_ACCESS_TOKEN"
    else
        TOKEN=$(echo "$GIT_REPO_URL" | sed -nE 's|^https://([^@]+)@.*|\1|p')
    fi

    if [ -z "$TOKEN" ]; then
        echo "[agent] Warning: No access token found, skipping PR creation"
        return 0
    fi

    # Call GitHub API
    local API_URL="https://api.github.com/repos/$OWNER/$REPO/pulls"
    local RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL" \
        -H "Authorization: Bearer $TOKEN" \
        -H "Accept: application/vnd.github+json" \
        -H "X-GitHub-Api-Version: 2022-11-28" \
        -H "Content-Type: application/json" \
        -d "{\"title\":\"$PR_TITLE\",\"head\":\"$FEATURE_BRANCH\",\"base\":\"$BASE_BRANCH\",\"body\":\"$PR_BODY\"}")

    local HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    local BODY=$(echo "$RESPONSE" | sed '$d')

    if [ "$HTTP_CODE" = "201" ]; then
        local PR_URL=$(echo "$BODY" | jq -r '.html_url')
        local PR_NUMBER=$(echo "$BODY" | jq -r '.number')
        echo "[agent] PR created successfully: $PR_URL (#$PR_NUMBER)"
        echo "$PR_URL" > /output/pr_url.txt
        echo "$PR_NUMBER" > /output/pr_number.txt
    elif [ "$HTTP_CODE" = "422" ]; then
        echo "[agent] PR already exists (422), looking up existing PR..."
        local SEARCH_URL="https://api.github.com/repos/$OWNER/$REPO/pulls?head=$OWNER:$FEATURE_BRANCH&base=$BASE_BRANCH&state=open"
        local SEARCH_RESP=$(curl -s "$SEARCH_URL" \
            -H "Authorization: Bearer $TOKEN" \
            -H "Accept: application/vnd.github+json" \
            -H "X-GitHub-Api-Version: 2022-11-28")
        local EXISTING_PR_URL=$(echo "$SEARCH_RESP" | jq -r '.[0].html_url // empty')
        local EXISTING_PR_NUMBER=$(echo "$SEARCH_RESP" | jq -r '.[0].number // empty')
        if [ -n "$EXISTING_PR_URL" ]; then
            echo "[agent] Found existing PR: $EXISTING_PR_URL (#$EXISTING_PR_NUMBER)"
            echo "$EXISTING_PR_URL" > /output/pr_url.txt
            echo "$EXISTING_PR_NUMBER" > /output/pr_number.txt
        fi
    else
        echo "[agent] Warning: Failed to create PR (HTTP $HTTP_CODE), but branch was pushed successfully"
        echo "[agent] Response: $BODY"
    fi
}

# ─── Step 3: Git commit & push (execute / opsx modes) ───
SHOULD_PUSH="false"
if [ "$AGENT_MODE" = "execute" ] || [ "$AGENT_MODE" = "opsx_plan" ] || [ "$AGENT_MODE" = "opsx_apply" ]; then
    SHOULD_PUSH="true"
fi

if [ "$SHOULD_PUSH" = "true" ] && [ -n "$GIT_REPO_URL" ]; then
    echo "[agent] Checking for file changes..."
    cd "$WORKSPACE"

    if ! git diff --quiet || ! git diff --cached --quiet || [ -n "$(git ls-files --others --exclude-standard)" ]; then
        echo "[agent] Committing changes..."

        # Determine branches
        FEATURE_BRANCH="${GIT_FEATURE_BRANCH:-${GIT_BRANCH:-main}}"
        BASE_BRANCH="${GIT_BASE_BRANCH:-main}"

        # Build commit message based on mode
        case "$AGENT_MODE" in
            opsx_plan)
                COMMIT_MSG="spec: generate OpenSpec artifacts"
                if [ -n "$OPSX_CHANGE_NAME" ]; then
                    COMMIT_MSG="spec($OPSX_CHANGE_NAME): generate OpenSpec artifacts"
                fi
                if [ "$OPSX_ACTION" = "archive" ]; then
                    COMMIT_MSG="spec($OPSX_CHANGE_NAME): archive OpenSpec change"
                fi
                ;;
            opsx_apply)
                COMMIT_MSG="feat: implement tasks from OpenSpec"
                if [ -n "$OPSX_CHANGE_NAME" ]; then
                    COMMIT_MSG="feat($OPSX_CHANGE_NAME): implement tasks from OpenSpec"
                fi
                ;;
            *)
                COMMIT_MSG="agent: auto-commit from workflow"
                if [ -n "$NODE_ID" ]; then
                    COMMIT_MSG="agent($NODE_ID): auto-commit from workflow"
                fi
                ;;
        esac

        # Create and switch to feature branch
        git checkout -b "$FEATURE_BRANCH" 2>&1 || git checkout "$FEATURE_BRANCH" 2>&1
        git add -A
        git commit -m "$COMMIT_MSG" 2>&1

        # Push to feature branch
        echo "[agent] Pushing to $FEATURE_BRANCH..."
        git push origin "$FEATURE_BRANCH" --force 2>&1
        echo "[agent] Changes pushed successfully to $FEATURE_BRANCH"

        # Create PR if requested
        if [ "$GIT_CREATE_PR" = "true" ]; then
            PR_TITLE="${GIT_PR_TITLE:-$COMMIT_MSG}"
            create_github_pr "$FEATURE_BRANCH" "$BASE_BRANCH" "$PR_TITLE" "$COMMIT_MSG"
        fi

        # ─── Record Git metadata ───
        COMMIT_HASH=$(git rev-parse HEAD 2>/dev/null || echo "")
        PR_URL_VALUE=$(cat /output/pr_url.txt 2>/dev/null || echo "")
        PR_NUMBER_VALUE=$(cat /output/pr_number.txt 2>/dev/null || echo "0")
        CHANGED_FILES=$(git diff --name-only HEAD~1 HEAD 2>/dev/null | head -50 || echo "")

        # Collect file change types via git diff --name-status
        CHANGED_FILES_DETAIL=$(git diff --name-status HEAD~1 HEAD 2>/dev/null | head -50 || echo "")

        # Resolve repo URL (strip credentials, convert SSH to HTTPS, remove .git suffix)
        REPO_URL=""
        REMOTE_URL=$(git remote get-url origin 2>/dev/null || echo "")
        if [ -n "$REMOTE_URL" ]; then
            if echo "$REMOTE_URL" | grep -q '^git@'; then
                REPO_URL=$(echo "$REMOTE_URL" | sed -E 's|^git@([^:]+):|https://\1/|')
            else
                REPO_URL=$(echo "$REMOTE_URL" | sed -E 's|^(https?://)([^@]+@)|\1|')
            fi
            REPO_URL=$(echo "$REPO_URL" | sed 's|\.git$||')
        fi

        # Build changed_files_detail JSON array
        DETAIL_JSON="[]"
        if [ -n "$CHANGED_FILES_DETAIL" ]; then
            DETAIL_JSON=$(echo "$CHANGED_FILES_DETAIL" | while IFS=$'\t' read -r status path rest; do
                [ -z "$status" ] && continue
                case "$status" in
                    A)  mapped="added" ;;
                    M)  mapped="modified" ;;
                    D)  mapped="deleted" ;;
                    R*) mapped="renamed"; [ -n "$rest" ] && path="$rest" ;;
                    *)  mapped="modified" ;;
                esac
                jq -n --arg p "$path" --arg s "$mapped" '{path:$p,status:$s}'
            done | jq -s '.')
            [ -z "$DETAIL_JSON" ] && DETAIL_JSON="[]"
        fi

        jq -n \
            --arg branch "$FEATURE_BRANCH" \
            --arg base_branch "$BASE_BRANCH" \
            --arg commit "$COMMIT_HASH" \
            --arg commit_msg "$COMMIT_MSG" \
            --arg pr_url "$PR_URL_VALUE" \
            --argjson pr_number "${PR_NUMBER_VALUE:-0}" \
            --arg changed_files "$CHANGED_FILES" \
            --arg repo_url "$REPO_URL" \
            --argjson changed_files_detail "$DETAIL_JSON" \
            '{
                branch: $branch,
                base_branch: $base_branch,
                commit: $commit,
                commit_message: $commit_msg,
                pr_url: $pr_url,
                pr_number: $pr_number,
                changed_files: ($changed_files | split("\n") | map(select(. != ""))),
                repo_url: $repo_url,
                changed_files_detail: $changed_files_detail
            }' > "$GIT_METADATA_FILE"

        echo "[agent] Git metadata written to $GIT_METADATA_FILE"
    else
        echo "[agent] No file changes detected."
    fi
fi

# ─── Step 4: Output result (to real stdout via fd 3) ───
if [ -f "$RESULT_FILE" ]; then
    cat "$RESULT_FILE" >&3
else
    echo '{"result": "completed", "summary": "Agent execution completed but no output file generated."}' >&3
fi

echo "[agent] Done."
