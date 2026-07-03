// Auth gerektirmez — landing sayfası fiyat tablosunu buradan çeker.
import type { FastifyInstance } from 'fastify';
import { getPublicPlans } from '../lib/plans.js';

export async function registerPublicPlansRoutes(app: FastifyInstance) {
  app.get('/public/plans', async () => {
    const plans = await getPublicPlans();
    return { plans };
  });
}
