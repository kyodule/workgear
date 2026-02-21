package db

import "time"

// FlowRun 流程实例
type FlowRun struct {
	ID          string     `json:"id"`
	TaskID      string     `json:"task_id"`
	WorkflowID  string     `json:"workflow_id"`
	ProjectID   *string    `json:"project_id"`
	Status      string     `json:"status"` // pending / running / completed / failed / cancelled
	Error       *string    `json:"error"`
	DslSnapshot *string    `json:"dsl_snapshot"`
	Variables   *string    `json:"variables"` // JSON string
	StartedAt   *time.Time `json:"started_at"`
	CompletedAt *time.Time `json:"completed_at"`
	CreatedAt   time.Time  `json:"created_at"`
	// Git repo cache fields
	IntegrationRef     *string `json:"integration_ref"`
	IntegrationHeadSha *string `json:"integration_head_sha"`
}

// NodeRun 节点执行实例
type NodeRun struct {
	ID              string     `json:"id"`
	FlowRunID       string     `json:"flow_run_id"`
	NodeID          string     `json:"node_id"`
	NodeType        *string    `json:"node_type"`
	NodeName        *string    `json:"node_name"`
	Status          string     `json:"status"` // pending / queued / running / completed / failed / rejected / waiting_human
	Attempt         int        `json:"attempt"`
	Input           *string    `json:"input"`  // JSON string
	Output          *string    `json:"output"` // JSON string
	Error           *string    `json:"error"`
	LockedBy        *string    `json:"locked_by"`
	LockedAt        *time.Time `json:"locked_at"`
	ReviewAction    *string    `json:"review_action"`  // approve / reject / edit_and_approve
	ReviewComment   *string    `json:"review_comment"`
	ReviewedAt      *time.Time `json:"reviewed_at"`
	StartedAt       *time.Time `json:"started_at"`
	CompletedAt     *time.Time `json:"completed_at"`
	Config             *string    `json:"config"` // JSON string: node configuration from DSL
	RecoveryCheckpoint *string `json:"recovery_checkpoint"`
	LogStream          *string `json:"log_stream"` // JSON array: [{type, content, timestamp}, ...]
	CreatedAt          time.Time  `json:"created_at"`
	// Git repo cache fields
	BaseSha      *string `json:"base_sha"`
	CommitSha    *string `json:"commit_sha"`
	WorktreePath *string `json:"worktree_path"`
}

// TimelineEvent 时间线事件
type TimelineEvent struct {
	ID        string    `json:"id"`
	TaskID    string    `json:"task_id"`
	FlowRunID *string   `json:"flow_run_id"`
	NodeRunID *string   `json:"node_run_id"`
	EventType string    `json:"event_type"`
	Content   string    `json:"content"` // JSON string
	CreatedAt time.Time `json:"created_at"`
}

// NodeRun 状态常量
const (
	StatusPending      = "pending"
	StatusQueued       = "queued"
	StatusRunning      = "running"
	StatusCompleted    = "completed"
	StatusFailed       = "failed"
	StatusRejected     = "rejected"
	StatusWaitingHuman = "waiting_human"
	StatusCancelled    = "cancelled"
)

// AgentProvider holds agent provider configuration from database
type AgentProvider struct {
	ID        string
	AgentType string
	Name      string
	Config    map[string]interface{} // JSON config
	IsDefault bool
}

// AgentModel holds agent model configuration from database
type AgentModel struct {
	ID          string
	ProviderID  string
	ModelName   string
	DisplayName *string
	IsDefault   bool
}

// AgentRoleConfig holds agent role configuration from database
type AgentRoleConfig struct {
	ID           string
	Slug         string
	AgentType    string
	ProviderID   *string // nil = use default provider for agent_type
	ModelID      *string // nil = use default model for provider
	SystemPrompt string
	SkillIDs     []string // Associated skill IDs
}

// Skill holds skill definition from database
type Skill struct {
	ID          string
	Name        string
	Description *string
	Prompt      string
	SourceURL   *string
}
