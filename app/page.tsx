"use client";
import ConvexFloatingBubble from "@/components/ConvexFloatingBubble";
import ImagePreview from "@/components/ImagePreview";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Webcam from "@/components/Webcam";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { SignInButton, UserButton } from "@clerk/nextjs";
import { Authenticated, Unauthenticated, useMutation, useQuery } from "convex/react";
import { Github } from "lucide-react";
import Link from "next/link";
import { FormEvent, useCallback, useRef, useState } from "react";
import { toast } from "sonner";

export default function Home() {
  return (
    <>
      <Authenticated>
        <div className="flex w-full justify-end p-2">
          <UserButton />
        </div>
        <Content />
      </Authenticated>
      <Unauthenticated>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 p-6 text-center">
          <h1 className="text-3xl sm:text-4xl font-semibold">Convex Drip Me Out</h1>
          <p className="text-muted-foreground max-w-prose">
            Sign in to upload a photo or use your camera, then we’ll generate an anime-styled,
            drippy chain effect.
          </p>
          <SignInButton>
            <Button>Sign in to get started</Button>
          </SignInButton>
          <Link
            href="https://github.com/michaelshimeles/drip-me-out"
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="View source code on GitHub"
          >
            <Button variant="ghost" size="icon">
              <Github />
            </Button>
          </Link>
        </div>
      </Unauthenticated>
    </>
  );
}

function Content() {
  const generateUploadUrl = useMutation(api.images.generateUploadUrl);
  const uploadAndScheduleGeneration = useMutation(api.images.uploadAndScheduleGeneration);
  const retryOriginalMutation = useMutation(api.generate.retryOriginal);

  const imageInput = useRef<HTMLInputElement>(null);
  const preparedRef = useRef<File | null>(null);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [isPreparing, setIsPreparing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);

  // Use the new simplified queries
  const galleryImages = useQuery(api.images.getGalleryImages) || [];
  const failedImages = useQuery(api.images.getFailedImages) || [];
  const hasActiveGenerations = useQuery(api.images.hasActiveGenerations) || false;

  // Map low-level errors to friendly, user-facing messages
  const toUserMessage = useCallback((error: unknown): string => {
    const msg = error instanceof Error ? error.message : String(error || "");
    if (msg.includes("Load failed") || msg.includes("Network") || msg.includes("Failed to fetch")) {
      return "Network issue during upload. Please check your connection and try again.";
    }
    if (msg.startsWith("VALIDATION:")) {
      return msg.replace(/^VALIDATION:\s*/, "");
    }
    // Fallback
    return "Something went wrong. Please try again.";
  }, []);

  // Helper to check if error is network-related
  const isNetworkError = (error: unknown): boolean => {
    const msg = error instanceof Error ? error.message : String(error || "");
    return (
      msg.includes("NetworkError") ||
      msg.includes("TypeError: Load failed") ||
      msg.includes("network connection was lost") ||
      msg.includes("Failed to fetch") ||
      msg.includes("Network request failed") ||
      msg.includes("access control checks")
    );
  };

  // Consolidated upload function for both file uploads and webcam captures
  const uploadImage = useCallback(
    async (file: File) => {
      setUploadError(null);
      setIsPreparing(true);

      try {
        // Prepare image (HEIC->JPEG, compress to <=5MB)
        const { prepareImageForUpload } = await import("@/lib/imagePrep");
        const { file: prepared } = await prepareImageForUpload(file);
        setIsPreparing(false);

        setIsUploading(true);

        // Attempt upload with retry logic (up to 2 attempts)
        let lastError: unknown = null;
        const maxAttempts = 2;

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
          try {
            // Get fresh upload URL for each attempt
            const uploadUrl = await generateUploadUrl();

            // Only use keepalive for small files (< 64KB limit in Safari)
            const useKeepAlive = prepared.size < 64 * 1024;

            const response = await fetch(uploadUrl, {
              method: "POST",
              headers: { "Content-Type": prepared.type },
              body: prepared,
              ...(useKeepAlive && { keepalive: true }),
            });

            if (!response.ok) {
              throw new Error(`Upload failed: ${response.status} ${response.statusText}`);
            }

            const { storageId } = await response.json();

            // Schedule generation using the consolidated backend mutation
            await uploadAndScheduleGeneration({ storageId });

            toast.success("Image Generation Started!", {
              description: "Your image is being processed in the background.",
              duration: 4000,
            });

            return true; // Success
          } catch (error) {
            lastError = error;

            // Only retry network errors on first attempt
            if (attempt === 1 && isNetworkError(error)) {
              console.log(`Upload attempt ${attempt} failed with network error, retrying...`);
              continue;
            }

            // Don't retry, exit loop
            break;
          }
        }

        // If we get here, all attempts failed
        throw lastError;
      } catch (error) {
        console.error("Upload failed:", error);
        const msg = toUserMessage(error);
        setUploadError(msg);
        toast.error("Upload failed", { description: msg });
        return false; // Failed
      } finally {
        setIsPreparing(false);
        setIsUploading(false);
      }
    },
    [generateUploadUrl, uploadAndScheduleGeneration, toUserMessage]
  );

  const handleImageCapture = async (imageData: string) => {
    setIsCapturing(true);
    try {
      const response = await fetch(imageData);
      const blob = await response.blob();
      const rawFile = new File([blob], `capture-${Date.now()}.jpg`, { type: "image/jpeg" });

      // Use the consolidated upload function
      await uploadImage(rawFile);
    } catch (error) {
      console.error("Failed to process captured image:", error);
      toast.error("Camera capture failed", { description: toUserMessage(error) });
    } finally {
      setIsCapturing(false);
    }
  };

  const retryUpload = useCallback(async () => {
    if (!selectedImage) return;

    const success = await uploadImage(selectedImage);
    if (success) {
      // Clear selection on success
      setSelectedImage(null);
      preparedRef.current = null;
      if (imageInput.current) imageInput.current.value = "";
    }
  }, [selectedImage, uploadImage]);

  const handleRetryFailed = useCallback(
    async (imageId: Id<"images">) => {
      try {
        await retryOriginalMutation({ imageId });
        toast.success("Retry scheduled", {
          description: "We queued your image for processing again.",
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err || "");
        toast.error("Retry failed", { description: msg });
      }
    },
    [retryOriginalMutation]
  );

  const handleSendImage = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedImage) return;

    // Client-side validation of type
    const allowed = new Set(["image/jpeg", "image/png", "image/heic", "image/heif"]);
    if (!allowed.has(selectedImage.type)) {
      toast.error("Unsupported file type", {
        description: "Please choose a JPEG, PNG, or HEIC/HEIF image.",
      });
      return;
    }

    const success = await uploadImage(selectedImage);
    if (success) {
      // Clear selection on success
      setSelectedImage(null);
      preparedRef.current = null;
      if (imageInput.current) imageInput.current.value = "";
    }
  };

  return (
    <div className="flex flex-col w-full min-h-screen p-4 lg:p-6">
      <div className="flex flex-col items-start justify-start gap-2 w-full">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-semibold">Convex Drip Me Out</h1>
          <Link
            href="https://github.com/michaelshimeles/drip-me-out"
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="View source code on GitHub"
          >
            <Button variant="ghost" size="icon">
              <Github />
            </Button>
          </Link>
        </div>
        <p className="text-sm text-muted-foreground">
          Upload an image or capture a photo to see what you look like with a diamond chain.
        </p>
      </div>
      <div className="w-full mt-6 sm:mt-8 lg:mt-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
          <div className="lg:max-w-2xl w-full">
            <Tabs defaultValue="camera">
              <TabsList>
                <TabsTrigger value="camera" className="text-sm font-medium">
                  📸 Camera
                </TabsTrigger>
                <TabsTrigger value="upload" className="text-sm font-medium">
                  📤 Upload
                </TabsTrigger>
                <TabsTrigger value="failed" className="text-sm font-medium">
                  ⚠️ Failed
                </TabsTrigger>
              </TabsList>
              <TabsContent value="upload" className="mt-4">
                <form onSubmit={handleSendImage} aria-label="Upload image form">
                  <Card>
                    <CardHeader>
                      <CardTitle>Upload Image</CardTitle>
                    </CardHeader>
                    <CardContent className="flex-1 flex flex-col justify-center">
                      <div className="space-y-4">
                        <Input
                          type="file"
                          accept="image/jpeg,image/png,image/heic,image/heif"
                          aria-label="Choose image file"
                          ref={imageInput}
                          onChange={(event) => {
                            setUploadError(null);
                            setSelectedImage(event.target.files?.[0] ?? null);
                          }}
                          disabled={isPreparing || isUploading}
                          className="w-full"
                        />

                        {uploadError && (
                          <div role="alert" className="text-sm text-destructive">
                            {uploadError.includes("Load failed")
                              ? "Network lost during upload. Please retry."
                              : uploadError}
                          </div>
                        )}

                        <div className="flex gap-2">
                          <Button
                            type="submit"
                            size="sm"
                            variant="outline"
                            className="w-full h-11"
                            aria-busy={isPreparing || isUploading}
                            disabled={isPreparing || isUploading || !selectedImage}
                          >
                            {isPreparing
                              ? "Preparing..."
                              : isUploading
                                ? "Uploading..."
                                : "Upload & Generate"}
                          </Button>
                          {uploadError && (
                            <Button
                              type="button"
                              onClick={retryUpload}
                              size="sm"
                              variant="default"
                              className="h-11"
                              disabled={isPreparing || isUploading}
                            >
                              Retry upload
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </form>
              </TabsContent>
              <TabsContent value="camera" className="mt-4">
                <div className="w-full">
                  <Webcam onCapture={handleImageCapture} isUploading={isCapturing} />
                </div>
              </TabsContent>
              <TabsContent value="failed" className="mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Failed Images</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {failedImages.length === 0 ? (
                      <div className="text-sm text-muted-foreground">
                        No failed images. Great job!
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {failedImages.map((img) => (
                          <div key={img._id} className="border rounded-lg overflow-hidden">
                            <div className="aspect-square bg-muted relative">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={img.url}
                                alt="Failed"
                                className="object-cover w-full h-full"
                              />
                              <div className="absolute inset-0 bg-red-600/50 flex items-center justify-center">
                                <span className="text-white text-sm font-medium">Failed</span>
                              </div>
                            </div>
                            <div className="p-3 flex items-center justify-between gap-2">
                              <div className="text-xs text-muted-foreground line-clamp-2">
                                {img.generationError || "Unknown error"}
                              </div>
                              <Button size="sm" onClick={() => handleRetryFailed(img._id)}>
                                Retry
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
          <div className="w-full">
            <ImagePreview images={galleryImages} />
          </div>
        </div>
        {hasActiveGenerations && (
          <div className="fixed bottom-4 right-4 lg:top-6 lg:right-6 z-50">
            <div className="flex items-center gap-2 bg-card/95 backdrop-blur-sm border border-border rounded-lg px-3 py-2 shadow-lg">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-accent"></div>
              <span className="text-sm text-muted-foreground font-medium">Generating...</span>
            </div>
          </div>
        )}
      </div>
      <ConvexFloatingBubble />
    </div>
  );
}
