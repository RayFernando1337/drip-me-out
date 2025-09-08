"use client";
import ConvexFloatingBubble from "@/components/ConvexFloatingBubble";
import ImagePreview from "@/components/ImagePreview";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Webcam from "@/components/Webcam";
import { api } from "@/convex/_generated/api";
import { Authenticated, Unauthenticated, useMutation, useQuery } from "convex/react";
import { SignInButton, UserButton } from "@clerk/nextjs";
import { Github } from "lucide-react";
import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import type { Id } from "@/convex/_generated/dataModel";

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
            Sign in to upload a photo or use your camera, then we’ll generate an anime-styled, drippy chain effect.
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
  const scheduleImageGeneration = useMutation(api.generate.scheduleImageGeneration);
  const retryOriginalMutation = useMutation(api.generate.retryOriginal);

  const imageInput = useRef<HTMLInputElement>(null);
  const preparedRef = useRef<File | null>(null);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [isPreparing, setIsPreparing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const imagesData = useQuery(api.images.getImages);
  const images = useMemo(() => imagesData || [], [imagesData]);
  const [isCapturing, setIsCapturing] = useState(false);

  const [displayedImages, setDisplayedImages] = useState<typeof images>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const IMAGES_PER_PAGE = 12;

  const prevCombinedLengthRef = useRef<number>(0);

  const combinedImages = useMemo(() => {
    const pendingOrProcessing = images.filter(
      (img) =>
        !img.isGenerated &&
        (img.generationStatus === "pending" || img.generationStatus === "processing")
    );
    const generated = images.filter((img) => img.isGenerated);
    const all = [...pendingOrProcessing, ...generated];
    // Ensure unique by _id (defensive)
    return all.filter((img, index, arr) => arr.findIndex((it) => it._id === img._id) === index);
  }, [images]);

  const hasActiveGenerations = useMemo(() => {
    return images.some(
      (img) => img.generationStatus === "pending" || img.generationStatus === "processing"
    );
  }, [images]);

  const failedImages = useMemo(() => {
    return images.filter((img) => !img.isGenerated && img.generationStatus === "failed");
  }, [images]);

  // Keep displayed images in sync with live updates (status changes) and pagination
  useEffect(() => {
    const uniqueImages = combinedImages.filter((img, index, arr) =>
      arr.findIndex((item) => item._id === img._id) === index
    );
    // Show pages 0..currentPage inclusive
    const end = Math.min((currentPage + 1) * IMAGES_PER_PAGE, uniqueImages.length);
    setDisplayedImages(uniqueImages.slice(0, end));
    prevCombinedLengthRef.current = uniqueImages.length;
  }, [combinedImages, currentPage, IMAGES_PER_PAGE]);

  const handleLoadMore = useCallback(() => {
    if (isLoadingMore) return;
    const uniqueImagesList = combinedImages.filter((img, index, arr) =>
      arr.findIndex((item) => item._id === img._id) === index
    );
    const totalImages = uniqueImagesList.length;
    const nextPage = currentPage + 1;
    const startIndex = nextPage * IMAGES_PER_PAGE;
    if (startIndex < totalImages) {
      setIsLoadingMore(true);
      setCurrentPage(nextPage);
      setIsLoadingMore(false);
    }
  }, [combinedImages, currentPage, isLoadingMore, IMAGES_PER_PAGE]);

  // Map low-level errors to friendly, user-facing messages
  const toUserMessage = (error: unknown): string => {
    const msg = error instanceof Error ? error.message : String(error || "");
    if (msg.includes("Load failed") || msg.includes("Network") || msg.includes("Failed to fetch")) {
      return "Network issue during upload. Please check your connection and try again.";
    }
    if (msg.startsWith("VALIDATION:")) {
      return msg.replace(/^VALIDATION:\s*/, "");
    }
    // Fallback
    return "Something went wrong. Please try again.";
  };

  const handleImageCapture = async (imageData: string) => {
    setIsCapturing(true);
    try {
      const response = await fetch(imageData);
      const blob = await response.blob();
      const rawFile = new File([blob], `capture-${Date.now()}.jpg`, { type: "image/jpeg" });

      // Prepare (compress/downscale) webcam capture the same way as file uploads (≤5MB)
      const { prepareImageForUpload } = await import("@/lib/imagePrep");
      const { file } = await prepareImageForUpload(rawFile);

      const { uploadAndSchedule } = await import("@/lib/uploadAndSchedule");
      setIsGenerating(true);
      const scheduleFn: (args: Record<string, unknown>) => Promise<unknown> = (args) =>
        scheduleImageGeneration({
          storageId: args.storageId as unknown as import("@/convex/_generated/dataModel").Id<"_storage">,
        });
      await uploadAndSchedule(file, generateUploadUrl, scheduleFn);
      toast.success("Upload started", {
        description: "Your image is being processed in the background.",
        duration: 4000,
      });
    } catch (error) {
      console.error("Failed to upload captured image:", error);
      toast.error("Upload failed", { description: toUserMessage(error) });
    } finally {
      setIsGenerating(false);
      setIsCapturing(false);
    }
  };

  const retryUpload = useCallback(async () => {
    if (!selectedImage && !preparedRef.current) return;
    setUploadError(null);
    setIsUploading(true);
    try {
      let prepared = preparedRef.current;
      if (!prepared && selectedImage) {
        setIsPreparing(true);
        const { prepareImageForUpload } = await import("@/lib/imagePrep");
        const { file } = await prepareImageForUpload(selectedImage);
        prepared = file;
        preparedRef.current = file;
        setIsPreparing(false);
      }
      if (!prepared) throw new Error("Nothing to upload. Please reselect your file.");

      const { uploadAndSchedule } = await import("@/lib/uploadAndSchedule");
      setIsGenerating(true);
      const scheduleFn: (args: Record<string, unknown>) => Promise<unknown> = (args) =>
        scheduleImageGeneration({
          storageId: args.storageId as unknown as import("@/convex/_generated/dataModel").Id<"_storage">,
        });
      await uploadAndSchedule(prepared, generateUploadUrl, scheduleFn);
      toast.success("Upload started", {
        description:
          "Your image is being processed. You can refresh the page – generation will continue in the background.",
        duration: 4000,
      });
      // Clear selection on success
      setSelectedImage(null);
      preparedRef.current = null;
      if (imageInput.current) imageInput.current.value = "";
    } catch (error) {
      console.error("Retry upload failed:", error);
      const msg = toUserMessage(error);
      setUploadError(msg);
      toast.error("Upload failed", { description: msg });
    } finally {
      setIsGenerating(false);
      setIsUploading(false);
    }
  }, [generateUploadUrl, scheduleImageGeneration, selectedImage]);

  const handleRetryFailed = useCallback(async (imageId: Id<"images">) => {
    try {
      await retryOriginalMutation({ imageId });
      toast.success("Retry scheduled", {
        description: "We queued your image for processing again.",
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err || "");
      toast.error("Retry failed", { description: msg });
    }
  }, [retryOriginalMutation]);

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

    setUploadError(null);
    setIsPreparing(true);
    try {
      // Prepare image (HEIC->JPEG, compress to <=5MB)
      const { prepareImageForUpload } = await import("@/lib/imagePrep");
      const { file: prepared } = await prepareImageForUpload(selectedImage);
      preparedRef.current = prepared;
    } catch (error) {
      console.error("Preparation failed:", error);
      const msg = error instanceof Error ? error.message : String(error || "");
      setUploadError(msg);
      toast.error("Preparation failed", { description: msg });
      setIsPreparing(false);
      return;
    }

    setIsPreparing(false);
    setIsUploading(true);
    try {
      const prepared = preparedRef.current!;
      const uploadUrl = await generateUploadUrl();
      const result = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": prepared.type },
        body: prepared,
      });
      if (!result.ok) {
        throw new Error(`Upload failed: ${result.statusText}`);
      }
      const { storageId } = await result.json();
      setIsGenerating(true);
      try {
        await scheduleImageGeneration({ storageId });
        toast.success("Image Generation Started!", {
          description:
            "Your image is being enhanced with AI. You can refresh the page - generation will continue in the background.",
          duration: 4000,
        });
        // Clear selection on success
        setSelectedImage(null);
        preparedRef.current = null;
        if (imageInput.current) imageInput.current.value = "";
      } catch (genError) {
        const msg = genError instanceof Error ? genError.message : String(genError || "");
        if (msg.startsWith("VALIDATION:")) {
          toast.error("Upload rejected", { description: msg.replace(/^VALIDATION:\s*/, "") });
        } else {
          toast.error("Processing unavailable", {
            description: "We couldn't start processing right now. Please try again shortly.",
            duration: 5000,
          });
        }
      } finally {
        setIsGenerating(false);
      }
    } catch (error) {
      console.error("Upload failed:", error);
      const msg = error instanceof Error ? error.message : String(error || "");
      setUploadError(msg);
      toast.error("Upload failed", { description: msg });
    } finally {
      setIsUploading(false);
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
                <TabsTrigger value="upload" className="text-sm font-medium">📤 Upload</TabsTrigger>
                <TabsTrigger value="failed" className="text-sm font-medium">⚠️ Failed</TabsTrigger>
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
                          disabled={isPreparing || isUploading || isGenerating}
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
                            aria-busy={isPreparing || isUploading || isGenerating}
                            disabled={isPreparing || isUploading || isGenerating || !selectedImage}
                          >
                            {isPreparing
                              ? "Preparing..."
                              : isUploading
                              ? "Uploading..."
                              : isGenerating
                              ? "Generating..."
                              : "Upload & Generate"}
                          </Button>
                          {uploadError && (
                            <Button
                              type="button"
                              onClick={retryUpload}
                              size="sm"
                              variant="default"
                              className="h-11"
                              disabled={isPreparing || isUploading || isGenerating}
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
                  <Webcam onCapture={handleImageCapture} isUploading={isCapturing || isGenerating} />
                </div>
              </TabsContent>
              <TabsContent value="failed" className="mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Failed Images</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {failedImages.length === 0 ? (
                      <div className="text-sm text-muted-foreground">No failed images. Great job!</div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {failedImages.map((img) => (
                          <div key={img._id} className="border rounded-lg overflow-hidden">
                            <div className="aspect-square bg-muted relative">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={img.url} alt="Failed" className="object-cover w-full h-full" />
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
            <ImagePreview
              images={displayedImages}
              totalImages={combinedImages.length}
              currentPage={currentPage}
              imagesPerPage={IMAGES_PER_PAGE}
              onLoadMore={handleLoadMore}
              hasMore={displayedImages.length < combinedImages.length}
              isLoading={isLoadingMore}
            />
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
