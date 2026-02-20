-- Add unique index on skills.name column
-- This ensures skill names are unique across the system

CREATE UNIQUE INDEX skills_name_unique ON skills(name);

COMMENT ON INDEX skills_name_unique IS 'Ensures skill names are unique';
