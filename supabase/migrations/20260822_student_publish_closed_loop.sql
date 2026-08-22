-- TICKET-122-R21：内容发布闭环（GAP-D）
-- 学生侧发布：内容被客户确认（status=ready && confirmed=true）后，学生填写
-- 「发布平台 + 链接 + 凭证（截图/说明）」提交，内容进入 published；
-- 管理员后台可查已发布记录作为代发验收依据。
--
-- member_contents 已有 platform / published_at 列；本迁移幂等补充发布闭环所需列，
-- 全部使用 IF NOT EXISTS，可安全重复执行；由管理员在部署时应用（执行手未写生产库）。

ALTER TABLE member_contents
  ADD COLUMN IF NOT EXISTS publish_link text;

ALTER TABLE member_contents
  ADD COLUMN IF NOT EXISTS publish_proof jsonb DEFAULT '{}'::jsonb;

ALTER TABLE member_contents
  ADD COLUMN IF NOT EXISTS published_by text;

ALTER TABLE member_contents
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_member_contents_status_published
  ON member_contents(status, published_at);
