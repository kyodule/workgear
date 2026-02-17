-- Git repo cache optimization: add integration and worktree tracking fields

-- flow_runs: track integration ref and head SHA for flow-level git integration
ALTER TABLE "flow_runs" ADD COLUMN "integration_ref" varchar(200);
ALTER TABLE "flow_runs" ADD COLUMN "integration_head_sha" varchar(100);

-- node_runs: track base SHA, commit SHA, and worktree path for node-level git state
ALTER TABLE "node_runs" ADD COLUMN "base_sha" varchar(100);
ALTER TABLE "node_runs" ADD COLUMN "commit_sha" varchar(100);
ALTER TABLE "node_runs" ADD COLUMN "worktree_path" varchar(500);
