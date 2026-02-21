package agent

import (
	"context"
	"fmt"
	"time"
)

// HumanAdapter handles human review nodes by pausing execution and waiting for manual input
type HumanAdapter struct{}

// NewHumanAdapter creates a new human adapter
func NewHumanAdapter() *HumanAdapter {
	return &HumanAdapter{}
}

func (h *HumanAdapter) Name() string {
	return "human"
}

// Execute pauses the workflow and waits for human review
// The actual review is handled by the orchestrator's review mechanism
func (h *HumanAdapter) Execute(ctx context.Context, req *AgentRequest) (*AgentResponse, error) {
	start := time.Now()

	// Human nodes don't execute immediately - they wait for external review
	// The orchestrator will mark this node as WAITING_REVIEW
	// and the frontend will notify the user to take action

	output := map[string]any{
		"status":  "waiting_review",
		"message": fmt.Sprintf("Waiting for human review on node '%s'", req.NodeID),
		"node_id": req.NodeID,
		"mode":    req.Mode,
	}

	// Include context for reviewer
	if len(req.Context) > 0 {
		output["context"] = req.Context
	}

	// Include prompt/instructions for reviewer
	if req.Prompt != "" {
		output["instructions"] = req.Prompt
	}

	duration := time.Since(start).Milliseconds()

	return &AgentResponse{
		Output: output,
		Metrics: &ExecutionMetrics{
			TokenInput:  0,
			TokenOutput: 0,
			DurationMs:  duration,
		},
	}, nil
}
