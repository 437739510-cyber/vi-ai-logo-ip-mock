-- TICKET-122-R20：学生获客归属闭环（GAP-C 修正）
-- 方向修正（Chris 2026-08-22 确认）：平台无线下触角，全国本地大学生负责当地获客，
-- 「管理员分配客户」作废，改为「学生获客归属」——student_assignments 由学生动作产生
-- （提交线索 / 认领客户，status=pending），管理员只做查看与纠错（确认/拒绝/解除，防抢单）。
--
-- student_assignments 表已存在（无创建入口），本迁移仅幂等补充闭环所需列，
-- 全部使用 IF NOT EXISTS，可安全重复执行；由管理员在部署时应用（执行手未写生产库）。

ALTER TABLE student_assignments
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'confirmed';

ALTER TABLE student_assignments
  ADD COLUMN IF NOT EXISTS source text;

ALTER TABLE student_assignments
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_student_assignments_student_status
  ON student_assignments(student_id, status);

CREATE INDEX IF NOT EXISTS idx_student_assignments_project
  ON student_assignments(project_id);
