export async function requireIdentity(ctx: any) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Not authenticated");
  return identity;
}

export async function assertOwner(ctx: any, ownerId: string | undefined) {
  const identity = await requireIdentity(ctx);
  if (!ownerId || ownerId !== identity.subject) {
    throw new Error("Not authorized to modify this image");
  }
  return identity;
}

export async function assertAdmin(ctx: any) {
  const identity = await requireIdentity(ctx);
  const isAdmin = identity.publicMetadata?.isAdmin === true;
  if (!isAdmin) throw new Error("Not authorized - admin only");
  return identity;
}