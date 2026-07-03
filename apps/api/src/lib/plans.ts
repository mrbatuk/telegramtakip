// Plan servisi — DB-driven, 60 sn cache.
// PlanConfig'i güncellediğinde invalidatePlanCache() çağır.

import { prisma } from '@tt/db';

export interface PlanLimits {
  key: string;
  name: string;
  description: string | null;
  maxBots: number;
  maxChannelsPerBot: number;
  maxActiveMembers: number;
  allowedPaymentMethods: string[]; // PaymentType stringleri
  features: string[];
  monthlyPriceTRY: number;
  isActive: boolean;
  isPublic: boolean;
  sortOrder: number;
  quarterlyMultiplier: number | null;
  yearlyMultiplier: number | null;
}

interface Cache {
  byKey: Map<string, PlanLimits>;
  expiresAt: number;
}
let cache: Cache | null = null;
const CACHE_MS = 60_000;

async function loadCache(): Promise<Cache> {
  const rows = await prisma.planConfig.findMany({ orderBy: { sortOrder: 'asc' } });
  const byKey = new Map<string, PlanLimits>();
  for (const p of rows) {
    byKey.set(p.key, {
      key: p.key,
      name: p.name,
      description: p.description,
      maxBots: p.maxBots,
      maxChannelsPerBot: p.maxChannelsPerBot,
      maxActiveMembers: p.maxActiveMembers,
      allowedPaymentMethods: p.allowedPaymentMethods,
      features: p.features,
      monthlyPriceTRY: Number(p.monthlyPriceTRY),
      isActive: p.isActive,
      isPublic: p.isPublic,
      sortOrder: p.sortOrder,
      quarterlyMultiplier: p.quarterlyMultiplier ? Number(p.quarterlyMultiplier) : null,
      yearlyMultiplier: p.yearlyMultiplier ? Number(p.yearlyMultiplier) : null,
    });
  }
  return { byKey, expiresAt: Date.now() + CACHE_MS };
}

async function getCache(): Promise<Cache> {
  if (cache && cache.expiresAt > Date.now()) return cache;
  cache = await loadCache();
  return cache;
}

export function invalidatePlanCache(): void {
  cache = null;
}

export async function getAllPlans(): Promise<PlanLimits[]> {
  const c = await getCache();
  return Array.from(c.byKey.values());
}

export async function getPublicPlans(): Promise<PlanLimits[]> {
  const all = await getAllPlans();
  return all.filter((p) => p.isPublic && p.isActive);
}

export async function getLimitsForPlan(key: string): Promise<PlanLimits | null> {
  const c = await getCache();
  return c.byKey.get(key) ?? null;
}

// Bir tenant'a özel plan (planOverride varsa üzerinden ezer)
export async function getLimitsForTenant(
  key: string,
  planOverride?: unknown,
): Promise<PlanLimits | null> {
  const base = await getLimitsForPlan(key);
  if (!base) return null;
  if (
    planOverride &&
    typeof planOverride === 'object' &&
    !Array.isArray(planOverride)
  ) {
    const ov = planOverride as Partial<PlanLimits>;
    return {
      ...base,
      ...(ov.maxBots !== undefined && { maxBots: ov.maxBots }),
      ...(ov.maxChannelsPerBot !== undefined && { maxChannelsPerBot: ov.maxChannelsPerBot }),
      ...(ov.maxActiveMembers !== undefined && { maxActiveMembers: ov.maxActiveMembers }),
      ...(ov.monthlyPriceTRY !== undefined && { monthlyPriceTRY: ov.monthlyPriceTRY }),
      ...(ov.allowedPaymentMethods !== undefined && { allowedPaymentMethods: ov.allowedPaymentMethods }),
    };
  }
  return base;
}

export async function isPaymentMethodAllowed(
  planKey: string,
  type: string,
): Promise<boolean> {
  const p = await getLimitsForPlan(planKey);
  return p ? p.allowedPaymentMethods.includes(type) : false;
}

// Ödeme fiyatını ay sayısına göre indirim çarpanıyla hesapla
export function calculateAmount(plan: PlanLimits, months: number): number {
  const base = plan.monthlyPriceTRY * months;
  let multiplier = 1;
  if (months >= 12 && plan.yearlyMultiplier !== null) multiplier = plan.yearlyMultiplier;
  else if (months >= 3 && plan.quarterlyMultiplier !== null) multiplier = plan.quarterlyMultiplier;
  return Math.round(base * multiplier * 100) / 100;
}
