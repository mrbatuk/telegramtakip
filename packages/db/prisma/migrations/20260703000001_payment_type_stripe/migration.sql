-- Migration: PaymentType enum'unda PAPARA -> STRIPE değişikliği
-- Papara'yı hiç entegre etmedik; global için Stripe ekliyoruz.
-- Var olan PAPARA satırları (payment_methods, saas_billing_methods, orders)
-- güvenlik için önce silinir (hiçbiri kullanılmadı).

-- Postgres enum'a yeni değer ekle
ALTER TYPE "PaymentType" ADD VALUE 'STRIPE';

-- Papara referansları temizlensin
DELETE FROM "payment_methods" WHERE "type" = 'PAPARA';
DELETE FROM "saas_billing_methods" WHERE "type" = 'PAPARA';
DELETE FROM "orders" WHERE "paymentMethod" = 'PAPARA';

-- PlanConfig.allowedPaymentMethods içindeki 'PAPARA' string'lerini kaldır
UPDATE "plans"
SET "allowedPaymentMethods" = array_remove("allowedPaymentMethods", 'PAPARA')
WHERE 'PAPARA' = ANY("allowedPaymentMethods");

-- Enum'dan PAPARA'yı çıkarmak: yeni enum tipi oluştur, kolonları taşı
CREATE TYPE "PaymentType_new" AS ENUM ('IBAN', 'PAYTR', 'IYZICO', 'STRIPE', 'USDT_TRC20');

ALTER TABLE "payment_methods" ALTER COLUMN "type" TYPE "PaymentType_new" USING ("type"::text::"PaymentType_new");
ALTER TABLE "saas_billing_methods" ALTER COLUMN "type" TYPE "PaymentType_new" USING ("type"::text::"PaymentType_new");
ALTER TABLE "orders" ALTER COLUMN "paymentMethod" TYPE "PaymentType_new" USING ("paymentMethod"::text::"PaymentType_new");

ALTER TYPE "PaymentType" RENAME TO "PaymentType_old";
ALTER TYPE "PaymentType_new" RENAME TO "PaymentType";
DROP TYPE "PaymentType_old";
