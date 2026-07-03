import type { FastifyInstance } from 'fastify';
import { registerAdminStatsRoutes } from './stats.js';
import { registerAdminTenantRoutes } from './tenants.js';
import { registerAdminSubscriptionRoutes } from './subscriptions.js';
import { registerAdminSystemRoutes } from './system.js';
import { registerAdminAuditRoutes } from './audit.js';
import { registerAdminSettingsRoutes } from './settings.js';
import { registerAdminBillingMethodsRoutes } from './billingMethods.js';
import { registerAdminPlansRoutes } from './plans.js';
import { registerAdminCouponsRoutes } from './coupons.js';

export async function registerAdminRoutes(app: FastifyInstance) {
  // Önce authenticate, sonra requireSuperAdmin — her admin endpoint
  app.addHook('onRequest', app.authenticate);
  app.addHook('onRequest', app.requireSuperAdmin);

  await app.register(registerAdminStatsRoutes);
  await app.register(registerAdminTenantRoutes);
  await app.register(registerAdminSubscriptionRoutes);
  await app.register(registerAdminSystemRoutes);
  await app.register(registerAdminAuditRoutes);
  await app.register(registerAdminSettingsRoutes);
  await app.register(registerAdminBillingMethodsRoutes);
  await app.register(registerAdminPlansRoutes);
  await app.register(registerAdminCouponsRoutes);
}
