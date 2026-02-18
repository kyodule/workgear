-- Add transient_artifacts column to node_runs table
-- This stores intermediate artifacts (like requirement understanding) that are not committed to Git

ALTER TABLE node_runs ADD COLUMN transient_artifacts JSONB;

COMMENT ON COLUMN node_runs.transient_artifacts IS 
  '瞬态产物：流程执行过程中的中间产物（如需求理解），不提交到 Git，但持久化到数据库供后续环节使用';

-- Create GIN index for efficient JSONB queries
CREATE INDEX idx_node_runs_transient_artifacts 
  ON node_runs USING gin(transient_artifacts) 
  WHERE transient_artifacts IS NOT NULL;
