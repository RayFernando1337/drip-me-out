import { Id } from "@/convex/_generated/dataModel";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import SharePageClient from "./client";

export async function generateMetadata({ params }: { params: Promise<{ imageId: string }> }) {
  const { imageId } = await params;
  
  // Fetch image data for rich metadata
  const image = await fetchQuery(api.images.getImageById, {
    imageId: imageId as Id<"images">,
  });
  
  if (!image) {
    return {
      title: "Image Not Found - Drip Me Out",
      description: "This image is no longer available.",
    };
  }
  
  return {
    title: "Check Out My Dripped Out Photo!",
    description: "I just got iced out with AI-generated diamond chains. Create your own!",
    openGraph: {
      title: "Check Out My Dripped Out Photo!",
      description: "I just got iced out with AI-generated diamond chains. Create your own!",
      images: [{ url: image.url }],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: "Check Out My Dripped Out Photo!",
      description: "I just got iced out with AI-generated diamond chains.",
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
  return <SharePageClient image={image} />;
}