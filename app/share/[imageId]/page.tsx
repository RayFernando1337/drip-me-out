import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { fetchQuery } from "convex/nextjs";
import Image from "next/image";
import SharePageClient from "./client";

export async function generateMetadata({ params }: { params: Promise<{ imageId: string }> }) {
  const { imageId } = await params;

  // Fetch image data for rich metadata
  const image = await fetchQuery(api.images.getImageById, {
    imageId: imageId as Id<"images">,
  });

  if (!image) {
    return {
      title: "Image Not Found - Anime Leak",
      description: "This image is no longer available.",
    };
  }

  return {
    title: "Check Out My Anime Transformation!",
    description: "Watch objects transform as anime leaks into reality. Create yours!",
    openGraph: {
      title: "Check Out My Anime Transformation!",
      description: "Watch objects transform as anime leaks into reality. Create yours!",
      images: [{ url: image.url }],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: "Check Out My Anime Transformation!",
      description: "Watch objects transform as anime leaks into reality.",
      images: [image.url],
    },
  };
}

export default async function SharePage({ params }: { params: Promise<{ imageId: string }> }) {
  const { imageId } = await params;

  // Server-side data fetching - no loading state needed!
  const image = await fetchQuery(api.images.getImageById, {
    imageId: imageId as Id<"images">,
  });

  // Pass pre-fetched data to client component
  if (!image) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="max-w-md space-y-6 text-center">
          <div className="flex justify-center">
            <div className="relative h-24 w-24">
              <Image src="/window.svg" alt="Image not found" fill className="opacity-50" />
            </div>
          </div>
          <div className="space-y-3">
            <h1 className="text-2xl font-semibold">This image is no longer available</h1>
            <p className="text-muted-foreground">
              The creator removed the image or it expired. Head back to the gallery to see the
              latest transformations.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return <SharePageClient image={image} />;
}
