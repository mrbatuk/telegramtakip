// Stripe ödeme sağlayıcısı — Checkout Session flow.
// Dokümantasyon: https://docs.stripe.com/api/checkout/sessions
//
// Credentials (tenant sağlar):
//   secretKey       - sk_live_... veya sk_test_...
//   webhookSecret   - whsec_... (Stripe Dashboard → Webhooks)
//   currency        - "try" | "usd" | "eur" (opsiyonel, default "try")
//
// Not: verifyIpn hem client redirect (successUrl'e ?session_id=...) hem de
// webhook (checkout.session.completed) çağrıları için kullanılabilir.
// - Client redirect: body.session_id ile session retrieve → hızlı ama
//   webhook her koşulda gelir; kesin kaynak webhook'tur.
// - Webhook: headers['stripe-signature'] + body.raw ile constructEvent.

import Stripe from 'stripe';
import type {
  PaymentProvider,
  PaymentInitInput,
  PaymentInitResult,
  IpnVerifyInput,
  IpnVerifyResult,
} from './adapter.js';

interface StripeCredentials {
  secretKey: string;
  webhookSecret: string;
  currency: string;
}

function getCreds(c: Record<string, string>): StripeCredentials {
  if (!c.secretKey) throw new Error('Stripe credentials eksik: secretKey');
  if (!c.webhookSecret) throw new Error('Stripe credentials eksik: webhookSecret');
  return {
    secretKey: c.secretKey,
    webhookSecret: c.webhookSecret,
    currency: (c.currency ?? 'try').toLowerCase(),
  };
}

function makeClient(creds: StripeCredentials): Stripe {
  return new Stripe(creds.secretKey, { apiVersion: '2025-02-24.acacia' as Stripe.LatestApiVersion });
}

export const stripeProvider: PaymentProvider = {
  type: 'STRIPE',

  async validateCredentials(credentials) {
    try {
      const creds = getCreds(credentials);
      // secretKey formatı: sk_test_ veya sk_live_ ile başlar
      if (!/^sk_(test|live)_/.test(creds.secretKey)) {
        return { ok: false, error: 'secretKey sk_test_ veya sk_live_ ile başlamalı' };
      }
      if (!/^whsec_/.test(creds.webhookSecret)) {
        return { ok: false, error: 'webhookSecret whsec_ ile başlamalı' };
      }
      // Basit smoke test: balance retrieve (API key geçerliliğini doğrular)
      const client = makeClient(creds);
      await client.balance.retrieve();
      return { ok: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Geçersiz credentials';
      return { ok: false, error: msg };
    }
  },

  async initPayment(
    credentialsRaw: Record<string, string>,
    input: PaymentInitInput,
  ): Promise<PaymentInitResult> {
    const creds = getCreds(credentialsRaw);
    const client = makeClient(creds);

    // Stripe tutarı en küçük birimde ister (kuruş)
    const unitAmount = Math.round(input.amount * 100);

    const session = await client.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      client_reference_id: input.orderId,
      customer_email: input.userEmail,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: creds.currency,
            unit_amount: unitAmount,
            product_data: {
              name: input.productName.slice(0, 250),
            },
          },
        },
      ],
      // Kullanıcı ödeme sonrası buraya döner (?session_id={CHECKOUT_SESSION_ID} eklenir)
      success_url: `${input.successUrl}${input.successUrl.includes('?') ? '&' : '?'}session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: input.failUrl,
      metadata: {
        orderId: input.orderId,
      },
    });

    if (!session.url) {
      throw new Error('Stripe Checkout Session URL alınamadı');
    }

    return {
      paymentUrl: session.url,
      providerRef: session.id,
    };
  },

  async verifyIpn(
    credentialsRaw: Record<string, string>,
    input: IpnVerifyInput,
  ): Promise<IpnVerifyResult> {
    const creds = getCreds(credentialsRaw);
    const client = makeClient(creds);

    // 1) Webhook akışı: stripe-signature header'ı varsa constructEvent
    const sig = input.headers?.['stripe-signature'];
    const rawBody = input.body._rawBody; // ham gövde — webhook route'ta set edilmeli

    if (sig && rawBody) {
      try {
        const signature = Array.isArray(sig) ? sig[0]! : sig;
        const event = client.webhooks.constructEvent(rawBody, signature, creds.webhookSecret);

        if (event.type === 'checkout.session.completed') {
          const session = event.data.object as Stripe.Checkout.Session;
          const paid = session.payment_status === 'paid';
          const orderId = session.client_reference_id ?? session.metadata?.orderId ?? '';
          const amount = (session.amount_total ?? 0) / 100;

          return {
            ok: true,
            orderId,
            amount,
            status: paid ? 'success' : 'failed',
            reason: paid ? undefined : `payment_status=${session.payment_status}`,
            ackResponse: 'OK',
          };
        }
        // Bu event türü bizim için önemli değil ama Stripe 200 bekler
        return { ok: true, ackResponse: 'OK', reason: `ignored:${event.type}` };
      } catch (err) {
        return {
          ok: false,
          ackResponse: 'BAD_SIGNATURE',
          reason: err instanceof Error ? err.message : 'signature_verify_failed',
        };
      }
    }

    // 2) Client-redirect akışı: session_id ile retrieve
    const sessionId = input.body.session_id;
    if (!sessionId) {
      return { ok: false, ackResponse: 'MISSING_SESSION_ID', reason: 'missing_session_id' };
    }

    try {
      const session = await client.checkout.sessions.retrieve(sessionId);
      const paid = session.payment_status === 'paid';
      const orderId = session.client_reference_id ?? session.metadata?.orderId ?? '';
      const amount = (session.amount_total ?? 0) / 100;

      return {
        ok: true,
        orderId,
        amount,
        status: paid ? 'success' : 'failed',
        reason: paid ? undefined : `payment_status=${session.payment_status}`,
        ackResponse: 'OK',
      };
    } catch (err) {
      return {
        ok: false,
        ackResponse: 'FAILURE',
        reason: err instanceof Error ? err.message : 'stripe_retrieve_failed',
      };
    }
  },
};
