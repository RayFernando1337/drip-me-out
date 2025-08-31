import SharePageClient from "./client";

export async function generateMetadata({ params }: { params: Promise<{ imageId: string }> }) {
  await params; // Await params to satisfy Next.js 15 requirements
  // Metadata generation will be handled client-side for now
  // In Phase 4 we can add server-side metadata fetching
  return {
    title: "Dripped Out Image",
    description: "Check out my AI-generated diamond chain photo!",
  };
}

export default async function SharePage({ params }: { params: Promise<{ imageId: string }> }) {
  const { imageId } = await params;
  return <SharePageClient imageId={imageId} />;
}