-- Add config column to node_runs table
-- This stores node configuration from DSL (e.g., artifactScope, mode, transient, editable)

ALTER TABLE node_runs ADD COLUMN config JSONB;

COMMENT ON COLUMN node_runs.config IS 
  '节点配置：从 DSL 中提取的节点配置（如 artifactScope、mode、transient、editable），供前端使用';

-- Create GIN index for efficient JSONB queries
CREATE INDEX idx_node_runs_config 
  ON node_runs USING gin(config) 
  WHERE config IS NOT NULL;
