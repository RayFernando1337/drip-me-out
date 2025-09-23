import type { Id } from "../_generated/dataModel";
import type { ActionCtx, MutationCtx, QueryCtx } from "../_generated/server";

export async function mapImagesToUrls<T extends { body: Id<"_storage"> }>(
  ctx: Pick<QueryCtx, "storage"> | Pick<MutationCtx, "storage"> | Pick<ActionCtx, "storage">,
  docs: Array<T>
) {
  const urls = await Promise.all(docs.map((d) => ctx.storage.getUrl(d.body)));
  return docs
    .map((d, i) => (urls[i] ? { ...d, url: urls[i] as string } : null))
    .filter((x): x is T & { url: string } => x !== null);
}
