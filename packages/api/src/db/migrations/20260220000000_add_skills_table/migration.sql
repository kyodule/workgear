-- Create skills table
-- This table stores skill definitions that can be imported from URLs

CREATE TABLE skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(200) NOT NULL,
  description TEXT,
  prompt TEXT NOT NULL,
  source_url VARCHAR(1000),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

COMMENT ON TABLE skills IS 'Skill 定义表：存储可从 URL 导入的 Skill 定义';
COMMENT ON COLUMN skills.source_url IS '导入来源 URL（如 GitHub raw URL）';
