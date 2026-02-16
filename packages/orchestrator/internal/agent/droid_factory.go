package agent

import (
	"go.uber.org/zap"
)

// DroidFactory creates adapters for droid agent type
type DroidFactory struct {
	PromptBuilder *PromptBuilder
}

func (f *DroidFactory) AgentType() string { return "droid" }

func (f *DroidFactory) CreateAdapter(logger *zap.SugaredLogger, providerID string, config map[string]any, modelName string) (Adapter, error) {
	// Droid uses provider_type, base_url, and api_key from provider config
	providerType, _ := config["provider_type"].(string)
	baseURL, _ := config["base_url"].(string)
	apiKey, _ := config["api_key"].(string)

	dockerExec, err := NewDockerExecutorWithImage(logger, "workgear/agent-droid:latest")
	if err != nil {
		return nil, err
	}

	adapter := NewDroidAdapter(f.PromptBuilder, providerID, providerType, apiKey, baseURL, modelName)
	return NewCombinedAdapter(adapter, dockerExec), nil
}
