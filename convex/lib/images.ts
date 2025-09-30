import type { Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

type StorageReader = { storage: Pick<QueryCtx["storage"], "getUrl"> };

export async function mapImagesToUrls<T extends { body: Id<"_storage"> }>(
  ctx: StorageReader,
  docs: Array<T>
) {
  const urls = await Promise.all(docs.map((d) => ctx.storage.getUrl(d.body)));
  return docs
    .map((d, i) => (urls[i] ? { ...d, url: urls[i] as string } : null))
    .filter((x): x is T & { url: string } => x !== null);
}
