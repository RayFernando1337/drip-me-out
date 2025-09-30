import type { QueryCtx, MutationCtx } from "../_generated/server";

type Ctx = QueryCtx | MutationCtx;

export type BillingSettings = {
  packPriceCents: number;
  creditsPerPack: number;
  refundOnFailure: boolean;
  freeTrialCredits: number;
  updatedAt?: number;
  updatedBy?: string;
};

const DEFAULTS: BillingSettings = {
  packPriceCents: 500,
  creditsPerPack: 420,
  refundOnFailure: true,
  freeTrialCredits: 10,
};

export async function getEffectiveBillingSettings(ctx: Ctx): Promise<BillingSettings> {
  const row = await ctx.db.query("billingSettings").take(1);
  if (row.length === 0) return DEFAULTS;
  const s = row[0] as Partial<BillingSettings>;
  return {
    packPriceCents: typeof s.packPriceCents === "number" ? s.packPriceCents : DEFAULTS.packPriceCents,
    creditsPerPack: typeof s.creditsPerPack === "number" ? s.creditsPerPack : DEFAULTS.creditsPerPack,
    refundOnFailure: typeof s.refundOnFailure === "boolean" ? s.refundOnFailure : DEFAULTS.refundOnFailure,
    freeTrialCredits: typeof s.freeTrialCredits === "number" ? s.freeTrialCredits : DEFAULTS.freeTrialCredits,
    updatedAt: s.updatedAt,
    updatedBy: s.updatedBy,
  };
}
