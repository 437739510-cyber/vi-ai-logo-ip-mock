-- Add new columns to submissions table
ALTER TABLE IF EXISTS submissions ADD COLUMN IF NOT EXISTS brand_vision TEXT DEFAULT '';
ALTER TABLE IF EXISTS submissions ADD COLUMN IF NOT EXISTS core_values TEXT DEFAULT '';
ALTER TABLE IF EXISTS submissions ADD COLUMN IF NOT EXISTS target_market TEXT DEFAULT '';
ALTER TABLE IF EXISTS submissions ADD COLUMN IF NOT EXISTS logo_philosophy TEXT DEFAULT '';
ALTER TABLE IF EXISTS submissions ADD COLUMN IF NOT EXISTS mascot_philosophy TEXT DEFAULT '';

-- Add brand_colors column uses JSONB which already exists on projects table
-- (projects.brand_colors is already JSONB)

-- Verify columns
SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'submissions' ORDER BY ordinal_position;