import type { Id } from "../_generated/dataModel";

export async function mapImagesToUrls<T extends { body: Id<"_storage"> }>(
  ctx: any,
  docs: Array<T>
) {
  const urls = await Promise.all(docs.map((d) => ctx.storage.getUrl(d.body)));
  return docs
    .map((d, i) => (urls[i] ? { ...d, url: urls[i] as string } : null))
    .filter((x): x is T & { url: string } => x !== null);
}

