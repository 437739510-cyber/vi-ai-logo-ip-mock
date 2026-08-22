-- TICKET-122-R19：注册审核闭环（GAP-B）
-- 公开申请写 students 表（status=pending），后台通过审核时需一键创建
-- student_accounts 并回写关联。本迁移为 students 表补充审核关联与拒绝备注字段。
--
-- 幂等：全部使用 IF NOT EXISTS，可安全重复执行；由管理员在部署时应用（本迁移文件
-- 只是代码交付物，执行手未在生产库执行任何写操作）。

ALTER TABLE students
  ADD COLUMN IF NOT EXISTS student_account_id uuid REFERENCES student_accounts(id);

ALTER TABLE students
  ADD COLUMN IF NOT EXISTS rejection_reason text;

CREATE INDEX IF NOT EXISTS idx_students_status ON students(status);
