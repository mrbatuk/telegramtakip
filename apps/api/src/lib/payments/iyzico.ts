// Iyzico ödeme sağlayıcısı — CheckoutForm flow.
// Dokümantasyon: https://docs.iyzico.com/en/products/checkout-form
//
// Credentials (tenant sağlar):
//   apiKey     - Merchant API key
//   secretKey  - Merchant secret key
//   sandbox    - "1" test, "0" prod

// @ts-expect-error iyzipay untyped
import Iyzipay from 'iyzipay';
import type {
  PaymentProvider,
  PaymentInitInput,
  PaymentInitResult,
  IpnVerifyInput,
  IpnVerifyResult,
} from './adapter.js';

interface IyzicoCredentials {
  apiKey: string;
  secretKey: string;
  sandbox?: string;
}

interface IyzipayCheckoutInitResult {
  status: 'success' | 'failure';
  token?: string;
  paymentPageUrl?: string;
  checkoutFormContent?: string;
  errorMessage?: string;
  errorCode?: string;
}

interface IyzipayCheckoutRetrieveResult {
  status: 'success' | 'failure';
  paymentStatus?: 'SUCCESS' | 'FAILURE';
  paymentId?: string;
  price?: string;
  paidPrice?: string;
  currency?: string;
  errorMessage?: string;
  errorCode?: string;
  token?: string;
  basketId?: string;
}

// iyzipay Node client tiplerini yok — dinamik olarak sarıyoruz
type IyzipayClient = {
  checkoutFormInitialize: {
    create: (
      req: Record<string, unknown>,
      cb: (err: Error | null, result: IyzipayCheckoutInitResult) => void,
    ) => void;
  };
  checkoutForm: {
    retrieve: (
      req: { locale?: string; conversationId?: string; token: string },
      cb: (err: Error | null, result: IyzipayCheckoutRetrieveResult) => void,
    ) => void;
  };
};

function getCreds(c: Record<string, string>): IyzicoCredentials {
  if (!c.apiKey || !c.secretKey) {
    throw new Error('Iyzico credentials eksik: apiKey, secretKey');
  }
  return {
    apiKey: c.apiKey,
    secretKey: c.secretKey,
    sandbox: c.sandbox ?? '1',
  };
}

function makeClient(creds: IyzicoCredentials): IyzipayClient {
  const uri =
    creds.sandbox === '1'
      ? 'https://sandbox-api.iyzipay.com'
      : 'https://api.iyzipay.com';
  return new Iyzipay({
    apiKey: creds.apiKey,
    secretKey: creds.secretKey,
    uri,
  }) as IyzipayClient;
}

function safeOid(id: string): string {
  return id.replace(/[^A-Za-z0-9]/g, '').slice(0, 128) || 'ORD';
}

function splitName(fullName: string): { first: string; last: string } {
  const trimmed = fullName.trim() || 'Musteri';
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return { first: parts[0]!, last: parts[0]! };
  return { first: parts.slice(0, -1).join(' '), last: parts.at(-1)! };
}

export const iyzicoProvider: PaymentProvider = {
  type: 'IYZICO',

  async validateCredentials(credentials) {
    try {
      getCreds(credentials);
      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : 'Geçersiz credentials',
      };
    }
  },

  async initPayment(
    credentialsRaw: Record<string, string>,
    input: PaymentInitInput,
  ): Promise<PaymentInitResult> {
    const creds = getCreds(credentialsRaw);
    const client = makeClient(creds);

    const merchant_oid = safeOid(input.orderId);
    const price = input.amount.toFixed(2);
    const { first, last } = splitName(input.userName);

    const req: Record<string, unknown> = {
      locale: 'tr',
      conversationId: merchant_oid,
      price,
      paidPrice: price,
      currency: 'TRY',
      basketId: merchant_oid,
      paymentGroup: 'PRODUCT',
      callbackUrl: input.callbackUrl,
      enabledInstallments: [1, 2, 3, 6, 9],
      buyer: {
        id: `tg${merchant_oid.slice(-16)}`,
        name: first,
        surname: last,
        gsmNumber: input.userPhone ?? '+905000000000',
        email: input.userEmail,
        identityNumber: '11111111111', // Iyzico zorunlu — anonim
        registrationAddress: input.userAddress ?? 'Online',
        ip: input.userIp,
        city: 'Istanbul',
        country: 'Turkey',
      },
      shippingAddress: {
        contactName: `${first} ${last}`,
        city: 'Istanbul',
        country: 'Turkey',
        address: input.userAddress ?? 'Online',
      },
      billingAddress: {
        contactName: `${first} ${last}`,
        city: 'Istanbul',
        country: 'Turkey',
        address: input.userAddress ?? 'Online',
      },
      basketItems: [
        {
          id: merchant_oid,
          name: input.productName.slice(0, 100),
          category1: 'Digital',
          itemType: 'VIRTUAL',
          price,
        },
      ],
    };

    const result = await new Promise<IyzipayCheckoutInitResult>((resolve, reject) => {
      client.checkoutFormInitialize.create(req, (err, data) => {
        if (err) reject(err);
        else resolve(data);
      });
    });

    if (result.status !== 'success' || !result.paymentPageUrl) {
      throw new Error(
        `Iyzico başlatma hatası: ${result.errorMessage ?? 'Bilinmeyen hata'} (${result.errorCode ?? '-'})`,
      );
    }

    return {
      paymentUrl: result.paymentPageUrl, // Iyzico hosted page
      providerRef: result.token ?? merchant_oid,
    };
  },

  // Iyzico "callback" = success sonrası kullanıcı callback URL'ine token ile geri döner.
  // Bu adapter'da verifyIpn callback token'ını kullanarak sunucudan ödemeyi çeker.
  async verifyIpn(
    credentialsRaw: Record<string, string>,
    input: IpnVerifyInput,
  ): Promise<IpnVerifyResult> {
    const creds = getCreds(credentialsRaw);
    const client = makeClient(creds);

    const token = input.body.token ?? '';
    if (!token) {
      return {
        ok: false,
        ackResponse: 'MISSING_TOKEN',
        reason: 'missing_token',
      };
    }

    const result = await new Promise<IyzipayCheckoutRetrieveResult>((resolve, reject) => {
      client.checkoutForm.retrieve(
        { locale: 'tr', token },
        (err, data) => {
          if (err) reject(err);
          else resolve(data);
        },
      );
    });

    if (result.status !== 'success') {
      return {
        ok: false,
        ackResponse: 'FAILURE',
        reason: result.errorMessage ?? 'iyzico_retrieve_failed',
      };
    }

    const paid = result.paymentStatus === 'SUCCESS';
    const merchant_oid = result.basketId ?? '';
    const amount = parseFloat(result.paidPrice ?? '0');

    return {
      ok: true,
      orderId: merchant_oid,
      amount,
      status: paid ? 'success' : 'failed',
      reason: paid ? undefined : (result.errorMessage ?? 'payment_failed'),
      ackResponse: 'OK',
    };
  },
};
