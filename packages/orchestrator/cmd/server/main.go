package main

import (
	"context"
	"fmt"
	"net"
	"os"
	"os/signal"
	"strconv"
	"syscall"

	"go.uber.org/zap"
	grpclib "google.golang.org/grpc"
	"google.golang.org/grpc/health"
	healthpb "google.golang.org/grpc/health/grpc_health_v1"

	"github.com/sunshow/workgear/orchestrator/internal/agent"
	"github.com/sunshow/workgear/orchestrator/internal/db"
	"github.com/sunshow/workgear/orchestrator/internal/engine"
	"github.com/sunshow/workgear/orchestrator/internal/event"
	grpcserver "github.com/sunshow/workgear/orchestrator/internal/grpc"
)

func main() {
	// Initialize logger
	logger, _ := zap.NewDevelopment()
	defer logger.Sync()
	sugar := logger.Sugar()

	port := os.Getenv("GRPC_PORT")
	if port == "" {
		port = "50051"
	}

	// Graceful shutdown context
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	// 1. Connect to PostgreSQL
	dbClient, err := db.NewClient(ctx, sugar)
	if err != nil {
		sugar.Fatalf("Failed to connect to database: %v", err)
	}
	defer dbClient.Close()

	// 2. Create event bus
	eventBus := event.NewBus(sugar)

	// 3. Create agent registry (load from database)
	registry := agent.NewRegistry()

	promptBuilder := agent.NewPromptBuilder()

	// Create agent factory registry
	factoryRegistry := agent.NewAgentFactoryRegistry()
	factoryRegistry.Register(&agent.ClaudeCodeFactory{PromptBuilder: promptBuilder})
	factoryRegistry.Register(&agent.CodexFactory{PromptBuilder: promptBuilder})
	factoryRegistry.Register(&agent.DroidFactory{PromptBuilder: promptBuilder})

	// Load agent config from database
	loadResult, err := agent.LoadConfig(ctx, sugar, dbClient, registry, factoryRegistry)
	if err != nil {
		sugar.Fatalf("Failed to load agent config: %v", err)
	}

	if loadResult.ProvidersLoaded == 0 {
		sugar.Fatalf("No agent providers available (database empty and no env fallback)")
	}

	// Startup validation: warn about unmapped default roles
	for _, role := range agent.DefaultRoles {
		if _, err := registry.GetAdapter(role); err != nil {
			sugar.Warnw("⚠ Default role has no working adapter at startup", "role", role)
		}
	}

	sugar.Infof("Agent registry initialized: %d providers, %d roles mapped", loadResult.ProvidersLoaded, loadResult.RolesMapped)

	// 4. Create flow executor with concurrency control
	maxConcurrency := 5
	if v := os.Getenv("MAX_CONCURRENCY"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			maxConcurrency = n
		}
	}
	executor := engine.NewFlowExecutor(dbClient, eventBus, registry, sugar, maxConcurrency)

	// 5. Start the worker loop (recovers stale state + polls for work)
	if err := executor.Start(ctx); err != nil {
		sugar.Fatalf("Failed to start executor: %v", err)
	}

	// 6. Start gRPC server
	lis, err := net.Listen("tcp", fmt.Sprintf(":%s", port))
	if err != nil {
		sugar.Fatalf("Failed to listen: %v", err)
	}

	server := grpclib.NewServer()

	// Register health check
	healthServer := health.NewServer()
	healthpb.RegisterHealthServer(server, healthServer)
	healthServer.SetServingStatus("orchestrator", healthpb.HealthCheckResponse_SERVING)

	// Register orchestrator service
	orchServer := grpcserver.NewOrchestratorServer(executor, eventBus, registry, factoryRegistry, dbClient, sugar)
	orchServer.Register(server)

	sugar.Infof("WorkGear Orchestrator gRPC server listening on :%s", port)
	sugar.Info("Phase 4: Persistent state machine + Docker agent support")

	go func() {
		if err := server.Serve(lis); err != nil {
			sugar.Fatalf("Failed to serve: %v", err)
		}
	}()

	<-ctx.Done()
	sugar.Info("Shutting down gRPC server...")
	server.GracefulStop()
	sugar.Info("Server stopped")
}
