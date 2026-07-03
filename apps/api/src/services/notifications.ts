// Uygulama bildirim servisi. Tüm email tetikleyicileri buradan geçer.
// Kullanıcı tercihlerine ve admin ayarlarına saygı gösterir.

import { prisma } from '@tt/db';
import { sendEmail } from '../lib/email/index.js';
import { getEmailConfig } from '../lib/email/config-source.js';
import {
  newTenantAdminTemplate,
  newReceiptTemplate,
  subExpiringTemplate,
} from '../lib/email/templates.js';
import { config } from '../config.js';
import { logger } from '../logger.js';

// ============================================================
// Admin'e: yeni tenant kaydoldu
// ============================================================
export async function notifyAdminNewTenant(tenant: {
  id: string;
  email: string;
  fullName: string | null;
  createdAt: Date;
}): Promise<void> {
  const emailCfg = await getEmailConfig();
  if (!emailCfg.adminNotificationEmail) return;

  await sendEmail(
    newTenantAdminTemplate({
      to: emailCfg.adminNotificationEmail,
      tenantEmail: tenant.email,
      fullName: tenant.fullName,
      createdAt: tenant.createdAt,
      adminUrl: `${config.PUBLIC_WEB_URL}${config.ADMIN_URL_PATH}/tenants/${tenant.id}`,
    }),
  );
}

// ============================================================
// Tenant'a: kanalına yeni dekont geldi
// ============================================================
export async function notifyTenantNewReceipt(params: {
  tenantEmail: string;
  channelName: string;
  userDisplay: string;
  amount: string;
  packageName: string;
}): Promise<void> {
  const tenant = await prisma.tenant.findUnique({
    where: { email: params.tenantEmail },
    select: { notifyOnNewReceipt: true },
  });
  if (!tenant?.notifyOnNewReceipt) return;

  try {
    await sendEmail(
      newReceiptTemplate({
        to: params.tenantEmail,
        channelName: params.channelName,
        userDisplay: params.userDisplay,
        amount: params.amount,
        packageName: params.packageName,
        panelUrl: `${config.PUBLIC_WEB_URL}/dashboard/orders`,
      }),
    );
  } catch (err) {
    logger.warn({ err }, 'new-receipt bildirimi gönderilemedi');
  }
}

// ============================================================
// Tenant'a: aboneliğin yaklaşıyor (cron/job tetikler)
// ============================================================
export async function notifyTenantSubExpiring(params: {
  tenantId: string;
  daysLeft: number;
}): Promise<void> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: params.tenantId },
    select: {
      email: true,
      fullName: true,
      subExpiresAt: true,
      notifyOnSubExpiry: true,
    },
  });
  if (!tenant?.notifyOnSubExpiry || !tenant.subExpiresAt) return;

  try {
    await sendEmail(
      subExpiringTemplate({
        to: tenant.email,
        fullName: tenant.fullName,
        daysLeft: params.daysLeft,
        expiresAt: tenant.subExpiresAt,
        subscriptionUrl: `${config.PUBLIC_WEB_URL}/dashboard/subscription`,
      }),
    );
  } catch (err) {
    logger.warn({ err }, 'sub-expiring bildirimi gönderilemedi');
  }
}
