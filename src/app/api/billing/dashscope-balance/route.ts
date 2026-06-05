import { NextResponse } from 'next/server';

// Alibaba Cloud BSS API - QueryAccountBalance
// Requires: ALIBABA_CLOUD_ACCESS_KEY_ID + ALIBABA_CLOUD_ACCESS_KEY_SECRET
// RAM user needs AliyunBSSReadOnlyAccess permission

const ACCESS_KEY_ID = process.env.ALIBABA_CLOUD_ACCESS_KEY_ID || '';
const ACCESS_KEY_SECRET = process.env.ALIBABA_CLOUD_ACCESS_KEY_SECRET || '';

interface BssBalanceData {
  AvailableCashAmount?: string;
  AvailableAmount?: string;
  CreditAmount?: string;
  Currency?: string;
}

function percentEncode(str: string): string {
  return encodeURIComponent(str)
    .replace(/\+/g, '%20')
    .replace(/\*/g, '%2A')
    .replace(/%7E/g, '~')
    .replace(/!/g, '%21')
    .replace(/'/g, '%27')
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29');
}

async function callBssApi(action: string): Promise<{ success: boolean; data?: BssBalanceData; message?: string }> {
  if (!ACCESS_KEY_ID || !ACCESS_KEY_SECRET) {
    return { success: false, message: 'AccessKey not configured' };
  }

  const params: Record<string, string> = {
    Action: action,
    Format: 'JSON',
    Version: '2017-12-14',
    AccessKeyId: ACCESS_KEY_ID,
    SignatureMethod: 'HMAC-SHA1',
    SignatureVersion: '1.0',
    SignatureNonce: Math.random().toString(36).substring(2, 15) + Date.now().toString(36),
    Timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
  };

  const sortedKeys = Object.keys(params).sort();
  const canonicalizedQueryString = sortedKeys
    .map(key => `${percentEncode(key)}=${percentEncode(params[key])}`)
    .join('&');

  const stringToSign = `GET&${percentEncode('/')}&${percentEncode(canonicalizedQueryString)}`;

  const crypto = await import('crypto');
  const signature = crypto
    .createHmac('sha1', ACCESS_KEY_SECRET + '&')
    .update(stringToSign)
    .digest('base64');

  params.Signature = signature;

  const url = `https://business.aliyuncs.com/?${sortedKeys
    .map(key => `${percentEncode(key)}=${percentEncode(params[key])}`)
    .join('&')}&Signature=${percentEncode(signature)}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    const data = await response.json();

    if (data.Code === '200' || data.Success === true) {
      return { success: true, data: data.Data };
    } else {
      return {
        success: false,
        message: data.Message || `BSS API error (${data.Code || response.status})`,
      };
    }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Network error';
    return { success: false, message: msg };
  }
}

export async function GET() {
  try {
    const result = await callBssApi('QueryAccountBalance');

    if (result.success && result.data) {
      const balance = result.data;
      const availableAmount = parseFloat(balance.AvailableAmount || '0');
      const cashAmount = parseFloat(balance.AvailableCashAmount || '0');
      const currency = balance.Currency || 'CNY';

      // IMPORTANT: Frontend reads "availableAmount" field (not "balance")
      return NextResponse.json({
        provider: 'Tongyi Wanxiang (Alibaba Cloud)',
        availableAmount: availableAmount,  // Frontend reads this field
        cashBalance: cashAmount,
        balance: availableAmount,  // Also provide "balance" for compatibility
        currency,
        source: 'BSS QueryAccountBalance',
        status: 'active',
        detail: `Available: ${currency} ${availableAmount.toFixed(2)} / Cash: ${currency} ${cashAmount.toFixed(2)}`,
      });
    }

    // Fallback: test API key validity
    const dashscopeKey =
      process.env.DASHSCOPE_API_KEY ||
      process.env.ALIYUN_API_KEY ||
      process.env.WANXIANG_API_KEY ||
      '';

    if (dashscopeKey) {
      return NextResponse.json({
        provider: 'Tongyi Wanxiang (Alibaba Cloud)',
        availableAmount: -1,
        balance: -1,
        currency: 'CNY',
        source: 'fallback',
        status: 'key_configured',
        detail: `BSS query failed: ${result.message}. API Key configured, check Alibaba Cloud console for balance`,
      });
    }

    return NextResponse.json(
      {
        provider: 'Tongyi Wanxiang (Alibaba Cloud)',
        availableAmount: null,
        balance: null,
        currency: 'CNY',
        error: result.message || 'Cannot query balance',
        detail: 'Please configure ALIBABA_CLOUD_ACCESS_KEY_ID + ALIBABA_CLOUD_ACCESS_KEY_SECRET and grant AliyunBSSReadOnlyAccess',
      },
      { status: 500 }
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Internal error';
    return NextResponse.json(
      {
        provider: 'Tongyi Wanxiang (Alibaba Cloud)',
        availableAmount: null,
        balance: null,
        currency: 'CNY',
        error: msg,
      },
      { status: 500 }
    );
  }
}
