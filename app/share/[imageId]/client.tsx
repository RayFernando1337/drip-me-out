"use client";

import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import { FunctionReturnType } from "convex/server";
import Image from "next/image";
import Link from "next/link";

// Use type inference from the API function for type safety
interface SharePageClientProps {
  image: FunctionReturnType<typeof api.images.getImageById>;
}

export default function SharePageClient({ image }: SharePageClientProps) {
  // Check if image is null (not found)
  if (image === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Image Not Found</h1>
          <p className="text-muted-foreground mb-6">
            This image doesn&apos;t exist or has been removed.
          </p>
          <Link href="/">
            <Button>Go to App</Button>
          </Link>
        </div>
      </div>
    );
  }

  // Check if sharing is disabled
  if (image.sharingEnabled === false) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Sharing Disabled</h1>
          <p className="text-muted-foreground mb-6">
            The owner has disabled sharing for this image.
          </p>
          <Link href="/">
            <Button>Create Your Own</Button>
          </Link>
        </div>
      </div>
    );
  }

  // Check if share link has expired
  if (image.shareExpiresAt && image.shareExpiresAt < Date.now()) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Link Expired</h1>
          <p className="text-muted-foreground mb-6">
            This share link has expired and is no longer available.
          </p>
          <Link href="/">
            <Button>Create Your Own</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-4xl w-full">
        <div className="relative w-full" style={{ maxHeight: "80vh" }}>
          <Image
            src={image.url}
            alt="Shared dripped out image"
            width={1200}
            height={800}
            className="w-full h-auto rounded-lg shadow-2xl"
            style={{ objectFit: "contain", maxHeight: "80vh" }}
            unoptimized={true}
            priority={true}
          />
        </div>
        <div className="mt-6 text-center">
          <Link href="/">
            <Button>Create Your Own</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
