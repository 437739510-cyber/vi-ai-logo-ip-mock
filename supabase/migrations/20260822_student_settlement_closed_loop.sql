-- TICKET-122-R22：结算闭环（GAP-E）——真实提成，学生拿大头。
-- 按「已确认内容/订单」生成待结算流水；流水状态机 pending → paid（打款）；
-- 学生累计已确认单数达到 20/50 单自动升级银/金级，提成比例随之变化。
--
-- student_accounts 已有 level / commission_rate / total_orders 列（旧建表引入），
-- 本迁移只新增 settlements 结算流水表，全部使用 IF NOT EXISTS，可安全重复执行；
-- 由管理员在部署时应用（执行手未写生产库）。

CREATE TABLE IF NOT EXISTS public.settlements (
  id text PRIMARY KEY,
  content_id text UNIQUE NOT NULL,
  member_id text NOT NULL,
  student_id text NOT NULL,
  unit_price numeric NOT NULL DEFAULT 0,
  student_ratio numeric NOT NULL DEFAULT 72,
  platform_ratio numeric NOT NULL DEFAULT 28,
  student_amount numeric NOT NULL DEFAULT 0,
  platform_amount numeric NOT NULL DEFAULT 0,
  total_amount numeric NOT NULL DEFAULT 0,
  student_level text,
  tier text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'paid')),
  settled_at timestamptz DEFAULT now(),
  paid_at timestamptz,
  paid_by text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_settlements_student_status
  ON public.settlements(student_id, status);

CREATE INDEX IF NOT EXISTS idx_settlements_member
  ON public.settlements(member_id);

CREATE INDEX IF NOT EXISTS idx_settlements_settled_at
  ON public.settlements(settled_at DESC);
