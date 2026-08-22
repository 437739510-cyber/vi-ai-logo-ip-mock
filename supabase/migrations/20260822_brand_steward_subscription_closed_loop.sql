-- TICKET-122-R23：品牌管家订阅状态机（GAP-F）。
-- 订阅生效记录：激活/续费由管理员「确认付款」动作写入（不再靠人工改 plan/quota_total）；
-- 状态机 active → expired（周期到点惰性置位）/ paused（管理员暂停）；
-- 周期按生效期核算（30 天/周期），续费重置配额（members.quota_used=0, quota_total=12）。
--
-- 全部使用 IF NOT EXISTS，可安全重复执行；由管理员在部署时应用（执行手未写生产库）。

CREATE TABLE IF NOT EXISTS public.brand_steward_subscriptions (
  id text PRIMARY KEY,
  member_id text UNIQUE NOT NULL,
  plan text NOT NULL DEFAULT 'manager',
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'expired', 'paused')),
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  quota_total integer NOT NULL DEFAULT 12,
  source_project_id text,
  started_at timestamptz DEFAULT now(),
  renewed_at timestamptz,
  paused_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_brand_steward_subscriptions_member
  ON public.brand_steward_subscriptions(member_id);

CREATE INDEX IF NOT EXISTS idx_brand_steward_subscriptions_status
  ON public.brand_steward_subscriptions(status);

CREATE INDEX IF NOT EXISTS idx_brand_steward_subscriptions_period_end
  ON public.brand_steward_subscriptions(period_end);
