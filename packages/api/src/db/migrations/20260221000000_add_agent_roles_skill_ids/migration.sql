-- Add skill_ids column to agent_roles table
-- This allows agent roles to be associated with multiple skills

ALTER TABLE agent_roles ADD COLUMN skill_ids jsonb DEFAULT '[]' NOT NULL;

-- Create GIN index for efficient JSONB queries
CREATE INDEX idx_agent_roles_skill_ids ON agent_roles USING gin(skill_ids);

-- Add comments
COMMENT ON COLUMN agent_roles.skill_ids IS 'Agent 角色关联的 Skill ID 列表（UUID 数组）';
COMMENT ON INDEX idx_agent_roles_skill_ids IS 'GIN index for efficient skill_ids queries';
