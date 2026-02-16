package agent

import (
	"context"
	"os"

	"go.uber.org/zap"

	"github.com/sunshow/workgear/orchestrator/internal/db"
)

// LoadResult holds the result of a config reload
type LoadResult struct {
	ProvidersLoaded int
	RolesMapped     int
}

// DefaultRoles are the common roles that should always be mapped
var DefaultRoles = []string{"general-developer", "requirement-analyst", "code-reviewer", "qa-engineer", "spec-architect"}

// LoadConfig loads all agent providers and role mappings from the database into the registry.
// It builds a new temporary registry first, then atomically swaps it into the target registry.
// If any critical error occurs, the original registry remains untouched.
func LoadConfig(ctx context.Context, logger *zap.SugaredLogger, dbClient *db.Client, registry *Registry, factoryRegistry *AgentFactoryRegistry) (*LoadResult, error) {
	result := &LoadResult{}
	temp := NewRegistry()

	// 1. Load providers from database
	providers, err := dbClient.GetAllAgentProviders(ctx)
	if err != nil {
		return nil, err
	}

	if len(providers) > 0 {
		for _, p := range providers {
			defaultModel, _ := dbClient.GetDefaultModelForProvider(ctx, p.ID)
			modelName := ""
			if defaultModel != nil {
				modelName = defaultModel.ModelName
			}

			adapter, err := factoryRegistry.CreateAdapter(logger, p.AgentType, p.ID, p.Config, modelName)
			if err != nil {
				logger.Warnw("Failed to create adapter, skipping", "type", p.AgentType, "name", p.Name, "error", err)
				continue
			}
			temp.RegisterProvider(p.ID, adapter)
			result.ProvidersLoaded++
			logger.Infow("Registered provider", "id", p.ID, "type", p.AgentType, "name", p.Name, "default", p.IsDefault)
		}
	} else {
		// Fallback: use environment variables (backward compat)
		if os.Getenv("ANTHROPIC_API_KEY") != "" || os.Getenv("ANTHROPIC_AUTH_TOKEN") != "" {
			envConfig := map[string]any{
				"auth_token": os.Getenv("ANTHROPIC_AUTH_TOKEN"),
				"base_url":   os.Getenv("ANTHROPIC_BASE_URL"),
			}
			if envConfig["auth_token"] == "" {
				envConfig["auth_token"] = os.Getenv("ANTHROPIC_API_KEY")
			}
			adapter, err := factoryRegistry.CreateAdapter(logger, "claude-code", "env-fallback", envConfig, os.Getenv("CLAUDE_MODEL"))
			if err != nil {
				return nil, err
			}
			temp.RegisterProvider("env-fallback", adapter)
			result.ProvidersLoaded++
			logger.Warn("No providers in database, using environment variable fallback")
		}
	}

	// 2. Load role mappings from database
	roleConfigs, err := dbClient.GetAllAgentRoleConfigs(ctx)
	if err != nil {
		return nil, err
	}

	for slug, rc := range roleConfigs {
		providerID := ""
		modelName := ""

		if rc.ProviderID != nil {
			providerID = *rc.ProviderID
			if rc.ModelID != nil {
				m, _ := dbClient.GetAgentModel(ctx, *rc.ModelID)
				if m != nil {
					modelName = m.ModelName
				}
			} else {
				m, _ := dbClient.GetDefaultModelForProvider(ctx, providerID)
				if m != nil {
					modelName = m.ModelName
				}
			}
		} else {
			dp, _ := dbClient.GetDefaultProviderForType(ctx, rc.AgentType)
			if dp != nil {
				providerID = dp.ID
				m, _ := dbClient.GetDefaultModelForProvider(ctx, dp.ID)
				if m != nil {
					modelName = m.ModelName
				}
			} else if len(providers) == 0 {
				providerID = "env-fallback"
				modelName = os.Getenv("CLAUDE_MODEL")
			}
		}

		if providerID != "" {
			temp.MapRoleToProvider(slug, providerID, modelName)
			result.RolesMapped++
			logger.Infow("Mapped role", "role", slug, "provider", providerID, "model", modelName)
		} else {
			logger.Warnw("No provider found for role", "role", slug, "agent_type", rc.AgentType)
		}
	}

	// 3. Ensure common roles are mapped (fallback for roles not in DB)
	for _, role := range DefaultRoles {
		if _, err := temp.GetAdapter(role); err != nil {
			dp, _ := dbClient.GetDefaultProviderForType(ctx, "claude-code")
			if dp != nil {
				m, _ := dbClient.GetDefaultModelForProvider(ctx, dp.ID)
				mn := ""
				if m != nil {
					mn = m.ModelName
				}
				temp.MapRoleToProvider(role, dp.ID, mn)
				result.RolesMapped++
				logger.Infow("Auto-mapped default role", "role", role, "provider", dp.ID)
			} else if len(providers) == 0 {
				temp.MapRoleToProvider(role, "env-fallback", os.Getenv("CLAUDE_MODEL"))
				result.RolesMapped++
			}
		}
	}

	// 4. Atomically swap the new config into the live registry
	registry.SwapFrom(temp)

	return result, nil
}
