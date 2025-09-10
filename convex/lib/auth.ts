interface Identity {
  subject: string;
  publicMetadata?: Record<string, unknown> | undefined;
  unsafeMetadata?: Record<string, unknown> | undefined;
}

type Ctx = { auth: { getUserIdentity: () => Promise<Identity | null> } };

export async function requireIdentity(ctx: Ctx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Not authenticated");
  return identity;
}

export async function assertOwner(ctx: Ctx, ownerId: string | undefined) {
  const identity = await requireIdentity(ctx);
  if (!ownerId || ownerId !== identity.subject) {
    throw new Error("Not authorized to modify this image");
  }
  return identity;
}

type Db = {
  query: (name: string) => {
    withIndex: (
      idx: string,
      cb: (q: { eq: (field: string, value: string) => unknown }) => unknown
    ) => {
      unique: () => Promise<unknown>;
    };
  };
};

export async function assertAdmin(ctx: Ctx & { db: Db }) {
  const identity = await requireIdentity(ctx);
  // Authoritative reactive check from Convex DB
  const existing = await ctx.db
    .query("admins")
    .withIndex("by_userId", (q) => q.eq("userId", identity.subject))
    .unique();
  const isAdmin = !!existing;
  if (!isAdmin) throw new Error("Not authorized - admin only");
  return identity;
}
