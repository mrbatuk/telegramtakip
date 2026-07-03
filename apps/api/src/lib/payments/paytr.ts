// PayTR ödeme sağlayıcısı.
// Dokümantasyon: https://dev.paytr.com/iframe-api/iframe-api-1-adim
//
// Credentials:
//   merchant_id    - Sayısal id
//   merchant_key   - Token üretimi için
//   merchant_salt  - Token üretimi + IPN doğrulaması için
//   test_mode      - "1" sandbox, "0" prod

import { createHmac } from 'node:crypto';
import type {
  PaymentProvider,
  PaymentInitInput,
  PaymentInitResult,
  IpnVerifyInput,
  IpnVerifyResult,
} from './adapter.js';

const PAYTR_GET_TOKEN_URL = 'https://www.paytr.com/odeme/api/get-token';
const PAYTR_IFRAME_URL = 'https://www.paytr.com/odeme/guvenli/';

interface PayTRCredentials {
  merchant_id: string;
  merchant_key: string;
  merchant_salt: string;
  test_mode?: string; // "1" veya "0"
}

function getCreds(c: Record<string, string>): PayTRCredentials {
  if (!c.merchant_id || !c.merchant_key || !c.merchant_salt) {
    throw new Error('PayTR credentials eksik: merchant_id, merchant_key, merchant_salt');
  }
  return {
    merchant_id: c.merchant_id,
    merchant_key: c.merchant_key,
    merchant_salt: c.merchant_salt,
    test_mode: c.test_mode ?? '1',
  };
}

function trimUserName(name: string, max = 50): string {
  return name.trim().slice(0, max) || 'Müşteri';
}

function buildBasket(productName: string, amount: number): string {
  // PayTR user_basket: base64( JSON.stringify([[product, price, qty]]) )
  // price kuruş cinsinden olmamalı — sayısal TL (örn. 199.90)
  const item: [string, string, number] = [
    productName.slice(0, 100),
    amount.toFixed(2),
    1,
  ];
  return Buffer.from(JSON.stringify([item])).toString('base64');
}

function toKurus(amount: number): number {
  return Math.round(amount * 100);
}

export const paytrProvider: PaymentProvider = {
  type: 'PAYTR',

  async validateCredentials(credentials) {
    try {
      getCreds(credentials);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Geçersiz credentials' };
    }
  },

  async initPayment(
    credentialsRaw: Record<string, string>,
    input: PaymentInitInput,
  ): Promise<PaymentInitResult> {
    const creds = getCreds(credentialsRaw);

    const merchant_oid = input.orderId.replace(/[^A-Za-z0-9]/g, ''); // alphanumeric
    const email = input.userEmail || 'noemail@example.com';
    const payment_amount = String(toKurus(input.amount));
    const user_basket = buildBasket(input.productName, input.amount);
    const no_installment = '0';
    const max_installment = '0';
    const currency = 'TL';
    const test_mode = creds.test_mode ?? '1';
    const user_name = trimUserName(input.userName);
    const user_address = (input.userAddress ?? 'Online').slice(0, 100);
    const user_phone = (input.userPhone ?? '05000000000').slice(0, 20);
    const merchant_ok_url = input.successUrl;
    const merchant_fail_url = input.failUrl;
    const timeout_limit = '30';
    const debug_on = '1';

    // HMAC SHA256 imza (paytr_token)
    const hashStr =
      creds.merchant_id +
      input.userIp +
      merchant_oid +
      email +
      payment_amount +
      user_basket +
      no_installment +
      max_installment +
      currency +
      test_mode;

    const paytr_token = createHmac('sha256', creds.merchant_key)
      .update(hashStr + creds.merchant_salt)
      .digest('base64');

    const body = new URLSearchParams({
      merchant_id: creds.merchant_id,
      user_ip: input.userIp,
      merchant_oid,
      email,
      payment_amount,
      paytr_token,
      user_basket,
      debug_on,
      no_installment,
      max_installment,
      user_name,
      user_address,
      user_phone,
      merchant_ok_url,
      merchant_fail_url,
      timeout_limit,
      currency,
      test_mode,
    });

    const res = await fetch(PAYTR_GET_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    const data = (await res.json()) as { status: string; token?: string; reason?: string };

    if (data.status !== 'success' || !data.token) {
      throw new Error(`PayTR token alınamadı: ${data.reason ?? 'bilinmeyen hata'}`);
    }

    return {
      paymentUrl: `${PAYTR_IFRAME_URL}${data.token}`,
      providerRef: merchant_oid,
    };
  },

  async verifyIpn(
    credentialsRaw: Record<string, string>,
    input: IpnVerifyInput,
  ): Promise<IpnVerifyResult> {
    const creds = getCreds(credentialsRaw);
    const body = input.body;

    const merchant_oid = body.merchant_oid ?? '';
    const status = body.status ?? '';
    const total_amount = body.total_amount ?? '';
    const provided_hash = body.hash ?? '';

    // IPN hash: SHA256( merchant_oid + merchant_salt + status + total_amount )  → key = merchant_key
    const expected_hash = createHmac('sha256', creds.merchant_key)
      .update(merchant_oid + creds.merchant_salt + status + total_amount)
      .digest('base64');

    if (expected_hash !== provided_hash) {
      return {
        ok: false,
        ackResponse: 'PAYTR notification failed: bad hash',
        reason: 'invalid_signature',
      };
    }

    return {
      ok: true,
      orderId: merchant_oid,
      amount: parseInt(total_amount, 10) / 100, // kuruş → TL
      status: status === 'success' ? 'success' : 'failed',
      reason: body.failed_reason_msg,
      ackResponse: 'OK',
    };
  },
};
