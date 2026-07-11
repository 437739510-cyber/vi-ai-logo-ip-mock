import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/core/supabase';

interface FormFieldConfig {
  field_key: string;
  label: string;
  field_type: string;
  required: boolean;
}

const DEFAULT_CONFIG: FormFieldConfig[] = [
  { field_key: 'clientName', label: '联系人姓名', field_type: 'text', required: true },
  { field_key: 'phone', label: '联系电话', field_type: 'text', required: true },
  { field_key: 'companyName', label: '公司名/店铺名', field_type: 'text', required: true },
  { field_key: 'wechat', label: '微信号', field_type: 'text', required: false },
  { field_key: 'email', label: '邮箱', field_type: 'text', required: false },
  { field_key: 'province', label: '所在省份', field_type: 'select', required: true },
  { field_key: 'city', label: '所在城市', field_type: 'select', required: true },
  { field_key: 'industry', label: '所属行业', field_type: 'select', required: true },
  { field_key: 'businessForm', label: '经营形态', field_type: 'select', required: true },
  { field_key: 'mainProducts', label: '主营产品', field_type: 'text', required: true },
  { field_key: 'businessYears', label: '经营年限', field_type: 'number', required: true },
  { field_key: 'storePhotos', label: '店内照片', field_type: 'file', required: false },
];

// GET /api/admin/form-config — return all field configs
export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('project_form_config')
      .select('*')
      .order('id');

    if (error) {
      console.warn('[form-config] Supabase read failed, using defaults:', error.message);
      return NextResponse.json({ success: true, fields: DEFAULT_CONFIG, source: 'defaults' });
    }

    if (!data || data.length === 0) {
      return NextResponse.json({ success: true, fields: DEFAULT_CONFIG, source: 'defaults' });
    }

    return NextResponse.json({ success: true, fields: data, source: 'supabase' });
  } catch (e) {
    console.warn('[form-config] GET error, using defaults:', e);
    return NextResponse.json({ success: true, fields: DEFAULT_CONFIG, source: 'defaults' });
  }
}

// PUT /api/admin/form-config — update field required status
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { field_key, required } = body;

    if (!field_key || typeof required !== 'boolean') {
      return NextResponse.json({ error: 'Missing field_key or required' }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from('project_form_config')
      .upsert({ field_key, required, updated_at: new Date().toISOString() }, { onConflict: 'field_key' });

    if (error) {
      console.error('[form-config] PUT error:', error.message);
      return NextResponse.json({ error: 'Failed to update config' }, { status: 500 });
    }

    return NextResponse.json({ success: true, field_key, required });
  } catch (e) {
    console.error('[form-config] PUT error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
