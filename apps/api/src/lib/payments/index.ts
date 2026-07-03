// Payment provider factory.
// Tip → ilgili adapter'ı döner.

import type { PaymentType } from '@tt/db';
import type { PaymentProvider } from './adapter.js';
import { paytrProvider } from './paytr.js';
import { iyzicoProvider } from './iyzico.js';
import { stripeProvider } from './stripe.js';

export function getProvider(type: PaymentType): PaymentProvider {
  switch (type) {
    case 'PAYTR':
      return paytrProvider;
    case 'IYZICO':
      return iyzicoProvider;
    case 'STRIPE':
      return stripeProvider;
    case 'USDT_TRC20':
    case 'IBAN':
      throw new Error(`${type} otomatik ödeme sağlayıcısı değil`);
    default: {
      const _exhaustive: never = type;
      throw new Error(`Bilinmeyen sağlayıcı: ${String(_exhaustive)}`);
    }
  }
}

export type { PaymentProvider } from './adapter.js';
export * from './adapter.js';
