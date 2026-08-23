-- TICKET-122-R26: 客户管理批量删除（软删除 + 操作日志）
-- 语义决策：软删除（deleted_at 标记），禁止删除有结算/归属/内容关联的客户；
-- 物理删会破坏 R22 结算账户与 R20 归属，软删除保留所有关联记录与结算水品牌名回填。
-- 本迁移文件只是代码交付物，由管理员在部署时应用（执行手未在生产库执行任何写操作）。
-- 全部使用 IF NOT EXISTS，可安全重复执行。
ALTER TABLE submissions
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_submissions_deleted_at
  ON public.submissions(deleted_at);

CREATE INDEX IF NOT EXISTS idx_projects_deleted_at
  ON public.projects(deleted_at);

-- 管理员操作日志（删除人/时间/动作/数量/明细）
CREATE TABLE IF NOT EXISTS public.admin_operation_logs (
  id text PRIMARY KEY,
  operator_id text,
  operator_role text,
  action text NOT NULL,
  entity_type text,
  entity_ids text[] DEFAULT '{}',
  detail jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_operation_logs_created_at
  ON public.admin_operation_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_operation_logs_action
  ON public.admin_operation_logs(action);
