-- 临时去掉外键约束以完成数据迁移
ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_submission_id_fkey;
ALTER TABLE ai_plans DROP CONSTRAINT IF EXISTS ai_plans_project_id_fkey;
ALTER TABLE vi_manuals DROP CONSTRAINT IF EXISTS vi_manuals_project_id_fkey;
ALTER TABLE vi_manuals DROP CONSTRAINT IF EXISTS vi_manuals_plan_id_fkey;
ALTER TABLE favorites DROP CONSTRAINT IF EXISTS favorites_plan_id_fkey;
ALTER TABLE favorites DROP CONSTRAINT IF EXISTS favorites_project_id_fkey;
ALTER TABLE manual_pages DROP CONSTRAINT IF EXISTS manual_pages_project_id_fkey;
