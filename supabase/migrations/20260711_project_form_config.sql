-- Migration: Create project_form_config table for admin field toggles
-- Date: 2026-07-11

CREATE TABLE IF NOT EXISTS project_form_config (
  id SERIAL PRIMARY KEY,
  field_key TEXT UNIQUE NOT NULL,
  label TEXT NOT NULL,
  field_type TEXT NOT NULL DEFAULT 'text',
  required BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Default config: storePhotos/wechat/email = optional, rest = required
INSERT INTO project_form_config (field_key, label, field_type, required) VALUES
('clientName', '联系人姓名', 'text', true),
('phone', '联系电话', 'text', true),
('companyName', '公司名/店铺名', 'text', true),
('wechat', '微信号', 'text', false),
('email', '邮箱', 'text', false),
('province', '所在省份', 'select', true),
('city', '所在城市', 'select', true),
('industry', '所属行业', 'select', true),
('businessForm', '经营形态', 'select', true),
('mainProducts', '主营产品', 'text', true),
('businessYears', '经营年限', 'number', true),
('storePhotos', '店内照片', 'file', false)
ON CONFLICT (field_key) DO NOTHING;
