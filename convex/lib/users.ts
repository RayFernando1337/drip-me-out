import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";
import { getEffectiveBillingSettings } from "./billing";

type Ctx = MutationCtx | QueryCtx;

export async function getUserById(ctx: Ctx, userId: string): Promise<Doc<"users"> | null> {
  return await ctx.db
    .query("users")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .unique();
}

export async function getOrCreateUser(ctx: MutationCtx, userId: string): Promise<Doc<"users">> {
  const existing = await getUserById(ctx, userId);
  if (existing) return existing;
  const settings = await getEffectiveBillingSettings(ctx);
  const now = Date.now();
  const _id = await ctx.db.insert("users", {
    userId,
    credits: settings.freeTrialCredits || 0,
    createdAt: now,
    updatedAt: now,
  });
  const created = await ctx.db.get(_id);
  if (!created) throw new Error("Failed to create user record");
  return created;
}
