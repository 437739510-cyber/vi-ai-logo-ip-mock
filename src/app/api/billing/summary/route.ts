import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/core/supabase';

// DeepSeek余额查询
async function getDeepSeekBalance() {
  const key = process.env.DEEPSEEK_API_KEY || '';
  if (!key) return { provider: 'DeepSeek', balance: -1, currency: 'CNY', status: 'not_configured' };

  try {
    const res = await fetch('https://api.deepseek.com/user/balance', {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (res.ok) {
      const data = await res.json();
      const balance = data?.balance_infos?.[0]?.total_balance
        ? parseFloat(data.balance_infos[0].total_balance)
        : -1;
      return { provider: 'DeepSeek', balance, currency: 'CNY', status: 'active' };
    }
    return { provider: 'DeepSeek', balance: -1, currency: 'CNY', status: 'error' };
  } catch {
    return { provider: 'DeepSeek', balance: -1, currency: 'CNY', status: 'error' };
  }
}

// 阿里云百炼余额查询 — 直接调BSS API，不走内部HTTP
async function getDashScopeBalance() {
  const accessKeyId = process.env.ALIBABA_CLOUD_ACCESS_KEY_ID || '';
  const accessKeySecret = process.env.ALIBABA_CLOUD_ACCESS_KEY_SECRET || '';
  const dashscopeKey = process.env.DASHSCOPE_API_KEY || process.env.ALIYUN_API_KEY || '';

  if (!accessKeyId || !accessKeySecret) {
    if (dashscopeKey) {
      return {
        provider: '通义万相 (阿里云百炼)',
        balance: -1,
        currency: 'CNY',
        status: 'key_configured',
        detail: 'API Key已配置，但未配置AccessKey，无法查询余额',
      };
    }
    return {
      provider: '通义万相 (阿里云百炼)',
      balance: -1,
      currency: 'CNY',
      status: 'not_configured',
    };
  }

  try {
    const crypto = await import('crypto');
    const params: Record<string, string> = {
      Action: 'QueryAccountBalance',
      Format: 'JSON',
      Version: '2017-12-14',
      AccessKeyId: accessKeyId,
      SignatureMethod: 'HMAC-SHA1',
      SignatureVersion: '1.0',
      SignatureNonce: Math.random().toString(36).substring(2, 15) + Date.now().toString(36),
      Timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    };

    const percentEncode = (str: string) =>
      encodeURIComponent(str).replace(/\+/g, '%20').replace(/\*/g, '%2A').replace(/%7E/g, '~')
        .replace(/!/g, '%21').replace(/'/g, '%27').replace(/\(/g, '%28').replace(/\)/g, '%29');

    const sortedKeys = Object.keys(params).sort();
    const canonicalized = sortedKeys.map(k => `${percentEncode(k)}=${percentEncode(params[k])}`).join('&');
    const stringToSign = `GET&${percentEncode('/')}&${percentEncode(canonicalized)}`;
    const signature = crypto.createHmac('sha1', accessKeySecret + '&').update(stringToSign).digest('base64');
    params.Signature = signature;

    const url = `https://business.aliyuncs.com/?${sortedKeys.map(k => `${percentEncode(k)}=${percentEncode(params[k])}`).join('&')}&Signature=${percentEncode(signature)}`;
    const res = await fetch(url, { headers: { 'Content-Type': 'application/json' } });
    const data = await res.json();

    if (data.Code === '200' || data.Success === true) {
      const d = data.Data;
      const availableAmount = parseFloat(d?.AvailableAmount || '0');
      const cashAmount = parseFloat(d?.AvailableCashAmount || '0');
      return {
        provider: '通义万相 (阿里云百炼)',
        balance: availableAmount,
        currency: d?.Currency || 'CNY',
        status: 'active',
        detail: `可用: ¥${availableAmount.toFixed(2)} / 现金: ¥${cashAmount.toFixed(2)}`,
      };
    }

    return {
      provider: '通义万相 (阿里云百炼)',
      balance: -1,
      currency: 'CNY',
      status: 'error',
      detail: data.Message || `BSS查询失败 (${data.Code || res.status})`,
    };
  } catch {
    return {
      provider: '通义万相 (阿里云百炼)',
      balance: -1,
      currency: 'CNY',
      status: 'error',
      detail: '查询异常',
    };
  }
}

export async function GET() {
  const [deepseek, dashscope] = await Promise.all([
    getDeepSeekBalance(),
    getDashScopeBalance(),
  ]);

  return NextResponse.json({ deepseek, dashscope });
}
