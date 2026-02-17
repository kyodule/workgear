-- Migration: Add Git provider type and credentials fields
-- Purpose: Support GitHub, GitLab, and generic Git providers

-- Git provider type: github (default), gitlab, generic
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS git_provider_type VARCHAR(20) DEFAULT 'github' NOT NULL;

COMMENT ON COLUMN projects.git_provider_type IS 'Git provider type: github, gitlab, generic';

-- Custom base URL for self-hosted instances (e.g. https://gitlab.example.com)
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS git_base_url VARCHAR(500);

COMMENT ON COLUMN projects.git_base_url IS 'Custom Git provider base URL for self-hosted instances';

-- Username for generic Git HTTPS authentication
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS git_username VARCHAR(200);

COMMENT ON COLUMN projects.git_username IS 'Username for Git HTTPS authentication (generic provider)';

-- Password for generic Git HTTPS authentication
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS git_password VARCHAR(500);

COMMENT ON COLUMN projects.git_password IS 'Password for Git HTTPS authentication (generic provider)';
