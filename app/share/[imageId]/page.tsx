import SharePageClient from "./client";

export async function generateMetadata() {
  // Metadata generation will be handled client-side for now
  // In Phase 4 we can add server-side metadata fetching
  return {
    title: "Dripped Out Image",
    description: "Check out my AI-generated diamond chain photo!",
  };
}

export default async function SharePage({ params }: { params: { imageId: string } }) {
  return <SharePageClient imageId={params.imageId} />;
}