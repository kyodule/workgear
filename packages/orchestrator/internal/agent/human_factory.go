package agent

import (
	"go.uber.org/zap"
)

// HumanFactory creates adapters for human review nodes
type HumanFactory struct {
	PromptBuilder *PromptBuilder
}

func (f *HumanFactory) AgentType() string { return "human" }

func (f *HumanFactory) CreateAdapter(logger *zap.SugaredLogger, providerID string, config map[string]any, modelName string) (Adapter, error) {
	// Human adapter doesn't need Docker executor or any external dependencies
	return NewHumanAdapter(), nil
}
