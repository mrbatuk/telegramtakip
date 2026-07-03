// Payment provider adapter interface.
// Her sağlayıcı (PayTR, Iyzico, Stripe) bu interface'i implement eder.
// Multi-tenant: her tenant kendi merchant credentials'ını sağlar.

import type { PaymentType } from '@tt/db';

export interface PaymentInitInput {
  orderId: string;
  amount: number; // TL cinsinden
  currency: 'TRY';
  userIp: string;
  userEmail: string;
  userName: string;
  userPhone?: string;
  userAddress?: string;
  productName: string;
  // Ödeme bitiminde kullanıcı bu URL'lere yönlendirilir
  successUrl: string;
  failUrl: string;
  // Sağlayıcı IPN/callback için bu URL'i çağırır
  callbackUrl: string;
}

export interface PaymentInitResult {
  // Kullanıcıyı yönlendireceğimiz URL (iframe veya redirect)
  paymentUrl: string;
  // Sağlayıcıya özel referans (DB'de saklanır, geri eşleştirme için)
  providerRef: string;
}

export interface IpnVerifyInput {
  body: Record<string, string>;
  // Bazı sağlayıcılar header'da imza gönderir
  headers?: Record<string, string | string[] | undefined>;
}

export interface IpnVerifyResult {
  ok: boolean;
  orderId?: string;
  amount?: number;
  status?: 'success' | 'failed';
  reason?: string;
  // Sağlayıcıya geri dönecek cevap (ör. PayTR "OK" bekler)
  ackResponse: string;
}

export interface PaymentProvider {
  type: PaymentType;
  // Credentials geçerli mi (kayıt anında doğrulama için)
  validateCredentials(credentials: Record<string, string>): Promise<{ ok: boolean; error?: string }>;
  // Ödeme başlat → kullanıcıyı yönlendireceğimiz URL döner
  initPayment(
    credentials: Record<string, string>,
    input: PaymentInitInput,
  ): Promise<PaymentInitResult>;
  // Webhook/IPN doğrula → siparişi onaylamak için
  verifyIpn(
    credentials: Record<string, string>,
    input: IpnVerifyInput,
  ): Promise<IpnVerifyResult>;
}
