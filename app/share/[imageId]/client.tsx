"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import Link from "next/link";
import { Button } from "@/components/ui/button";

interface SharePageClientProps {
  imageId: string;
}

export default function SharePageClient({ imageId }: SharePageClientProps) {
  const image = useQuery(api.images.getImageById, { 
    imageId: imageId as Id<"images"> 
  });
  
  if (!image) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Image Not Found</h1>
          <p className="text-muted-foreground mb-6">
            This image may have expired or sharing may be disabled.
          </p>
          <Link href="/">
            <Button>Go to App</Button>
          </Link>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        <img
          src={image.url}
          alt="Shared dripped out image"
          className="w-full rounded-lg shadow-2xl"
        />
        <div className="mt-6 text-center">
          <Link href="/">
            <Button>Create Your Own</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}