"use client";
import ImagePreview from "@/components/ImagePreview";
import { Button } from "@/components/ui/button";
import Webcam from "@/components/Webcam";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { SignInButton, UserButton } from "@clerk/nextjs";
import { Authenticated, Unauthenticated, useMutation, useQuery } from "convex/react";
import { Camera, Github, Upload } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
        <div className="flex flex-col w-full min-h-screen">
          {/* Header for unauthenticated users */}
          <header className="flex items-center justify-between w-full px-6 py-4 border-b border-border/20">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Anime Studio</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Transform objects into anime illustrations
              </p>
            </div>
            <Link
              href="https://github.com/michaelshimeles/drip-me-out"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground transition-colors"
              aria-label="View source code on GitHub"
            >
              <Button variant="ghost" size="sm">
                <Github className="w-4 h-4" />
              </Button>
            </Link>
          </header>

          {/* Main content for unauthenticated users */}
          <main className="flex-1 flex flex-col items-center justify-center gap-8 p-6 text-center">
            <div className="space-y-6 max-w-2xl">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-purple-400 to-blue-500 flex items-center justify-center">
                <Upload className="w-8 h-8 text-white" />
              </div>
              <div className="space-y-4">
                <h2 className="text-3xl font-semibold">Bring your photos to life</h2>
                <p className="text-muted-foreground text-lg">
                  Transform objects in your photos into magical 2D anime illustrations. Sign in to
                  upload images and watch as everyday items come to life with whimsical anime charm!
                </p>
              </div>
              <SignInButton>
                <Button className="btn-primary px-8 py-4 text-base font-medium rounded-xl">
                  Start Creating
                </Button>
              </SignInButton>
            </div>
          </main>
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
  const [showMobileCamera, setShowMobileCamera] = useState(false);
  const [showDesktopCamera, setShowDesktopCamera] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  // Pagination state
  const [paginationOpts, setPaginationOpts] = useState<{
    numItems: number;
    cursor: string | null;
  }>({ numItems: 12, cursor: null });
  // Type for gallery images - infer from the paginated query
  type GalleryImageType = NonNullable<
    ReturnType<typeof useQuery<typeof api.images.getGalleryImagesPaginated>>
  >["page"][number];

  const [allGalleryImages, setAllGalleryImages] = useState<GalleryImageType[]>([]);

  // Use paginated query for better performance
  const galleryResult = useQuery(api.images.getGalleryImagesPaginated, { paginationOpts });
  const totalImagesCount = useQuery(api.images.getGalleryImagesCount) || 0;
  const failedImages = useQuery(api.images.getFailedImages) || [];
  const hasActiveGenerations = useQuery(api.images.hasActiveGenerations) || false;

  // Handle pagination results
  useEffect(() => {
    if (galleryResult?.page) {
      if (paginationOpts.cursor === null) {
        // First page - replace all images
        setAllGalleryImages(galleryResult.page);
      } else {
        // Additional pages - append to existing images
        setAllGalleryImages((prev) => [...prev, ...galleryResult.page]);
      }
    }
  }, [galleryResult, paginationOpts.cursor]);

  // Load more function
  const loadMoreImages = useCallback(() => {
    if (galleryResult?.continueCursor && !galleryResult.isDone) {
      setPaginationOpts({
        numItems: 12,
        cursor: galleryResult.continueCursor,
      });
    }
  }, [galleryResult]);

  // Reset pagination when new images are uploaded
  const resetPagination = useCallback(() => {
    setPaginationOpts({ numItems: 12, cursor: null });
    setAllGalleryImages([]);
  }, []);

  // Memoize gallery images for stable references
  const galleryImages = useMemo(() => allGalleryImages || [], [allGalleryImages]);

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

            toast.success("Transformation started", {
              description: "Your image is being processed",
            });

            // Reset pagination to show new image at top
            resetPagination();

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
    [generateUploadUrl, uploadAndScheduleGeneration, toUserMessage, resetPagination]
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

  // Drag and drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);

      const files = Array.from(e.dataTransfer.files);
      const imageFile = files.find((file) => file.type.startsWith("image/"));

      if (imageFile) {
        const allowed = new Set(["image/jpeg", "image/png", "image/heic", "image/heif"]);
        if (allowed.has(imageFile.type)) {
          await uploadImage(imageFile);
        } else {
          toast.error("Unsupported file type", {
            description: "Please choose a JPEG, PNG, or HEIC/HEIF image.",
          });
        }
      } else {
        toast.error("No image file found", {
          description: "Please drop an image file.",
        });
      }
    },
    [uploadImage]
  );

  return (
    <div className="flex flex-col w-full min-h-screen">
      {/* Proper Header with Navigation */}
      <header className="flex items-center justify-between w-full px-6 py-4 border-b border-border/20 bg-background/95 backdrop-blur-sm">
        <div className="flex items-center gap-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Anime Studio</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Transform objects into anime illustrations
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Desktop Webcam Toggle */}
          <div className="hidden md:flex items-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowDesktopCamera(!showDesktopCamera)}
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
            >
              <Camera className="w-4 h-4" />
              {showDesktopCamera ? "Hide Camera" : "Camera"}
            </Button>
          </div>

          <Link
            href="https://github.com/michaelshimeles/drip-me-out"
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="View source code on GitHub"
          >
            <Button variant="ghost" size="sm">
              <Github className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col">
        <div className="flex-1 px-6 py-6">
          {galleryImages.length === 0 && !hasActiveGenerations ? (
            /* Empty State with Drag & Drop */
            <div className="flex flex-col items-center justify-center h-full min-h-[400px] space-y-8">
              <div className="text-center space-y-4 max-w-md">
                <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-purple-400 to-blue-500 flex items-center justify-center">
                  <Upload className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-semibold mb-2">Bring your photos to life</h2>
                  <p className="text-muted-foreground">
                    Upload any image and watch objects transform into beautiful anime illustrations
                  </p>
                </div>
              </div>

              {/* Beautiful Drag & Drop Zone */}
              <div className="w-full max-w-2xl">
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`
                    relative border-2 border-dashed rounded-2xl p-8 md:p-12 transition-all duration-200
                    ${
                      isDragOver
                        ? "border-primary bg-primary/5 scale-[1.02]"
                        : "border-border hover:border-primary/50 hover:bg-muted/30"
                    }
                    ${isPreparing || isUploading ? "opacity-50 pointer-events-none" : ""}
                  `}
                >
                  <div className="text-center space-y-6">
                    <div className="space-y-2">
                      <Upload
                        className={`w-8 h-8 mx-auto transition-colors ${isDragOver ? "text-primary" : "text-muted-foreground"}`}
                      />
                      <div className="space-y-1">
                        <p
                          className={`font-medium transition-colors ${isDragOver ? "text-primary" : "text-foreground"}`}
                        >
                          {isDragOver ? "Drop your image here" : "Drag and drop your image"}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          or click to browse • JPEG, PNG, HEIC supported
                        </p>
                      </div>
                    </div>

                    {/* Hidden file input */}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/heic,image/heif"
                      ref={imageInput}
                      onChange={(event) => {
                        setUploadError(null);
                        const file = event.target.files?.[0];
                        if (file) {
                          uploadImage(file);
                        }
                      }}
                      disabled={isPreparing || isUploading}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                    />

                    {(isPreparing || isUploading) && (
                      <div className="space-y-2">
                        <div className="w-8 h-8 mx-auto border-2 border-primary border-t-transparent rounded-full animate-spin" />
                        <p className="text-sm text-muted-foreground">
                          {isPreparing ? "Preparing image..." : "Uploading..."}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Mobile Camera Option */}
                <div className="flex items-center justify-center mt-6 md:hidden">
                  <button
                    type="button"
                    onClick={() => setShowMobileCamera(!showMobileCamera)}
                    className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Camera className="w-4 h-4" />
                    {showMobileCamera ? "Hide camera" : "Use camera instead"}
                  </button>
                </div>

                {/* Mobile Camera */}
                {showMobileCamera && (
                  <div className="mt-6 p-4 bg-muted/30 rounded-lg md:hidden">
                    <Webcam onCapture={handleImageCapture} isUploading={isCapturing} />
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Gallery Display */
            <div className="space-y-6">
              {/* Gallery Header with Upload */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold">Your Transformations</h2>
                  <p className="text-sm text-muted-foreground">
                    {totalImagesCount} images transformed
                  </p>
                </div>

                {/* Quick Upload & Desktop Camera */}
                <div className="flex items-center gap-3">
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={`
                      relative border border-dashed rounded-lg p-3 transition-colors
                      ${isDragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}
                    `}
                  >
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/heic,image/heif"
                      aria-label="Upload another image"
                      onChange={(event) => {
                        setUploadError(null);
                        const file = event.target.files?.[0];
                        if (file) {
                          uploadImage(file);
                        }
                      }}
                      disabled={isPreparing || isUploading}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <div className="flex items-center gap-2 text-sm text-muted-foreground pointer-events-none">
                      <Upload className="w-4 h-4" />
                      {isPreparing
                        ? "Preparing..."
                        : isUploading
                          ? "Uploading..."
                          : "Drop or click"}
                    </div>
                  </div>
                </div>
              </div>

              {/* Desktop Webcam */}
              {showDesktopCamera && (
                <div className="hidden md:block">
                  <div className="bg-muted/30 rounded-lg p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-medium">Camera</h3>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowDesktopCamera(false)}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        Hide
                      </Button>
                    </div>
                    <Webcam onCapture={handleImageCapture} isUploading={isCapturing} />
                  </div>
                </div>
              )}

              <ImagePreview
                images={galleryImages}
                totalImages={totalImagesCount}
                onLoadMore={loadMoreImages}
                hasMore={!galleryResult?.isDone && !!galleryResult?.continueCursor}
                isLoading={galleryResult === undefined}
              />
            </div>
          )}
        </div>
      </main>

      {/* Minimal Status Indicator */}
      {hasActiveGenerations && (
        <div className="fixed top-4 right-4 z-50">
          <div className="flex items-center gap-2 bg-background/95 backdrop-blur-sm border border-border rounded-full px-3 py-2 shadow-lg">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
            <span className="text-xs text-muted-foreground">Processing</span>
          </div>
        </div>
      )}

      {/* Enhanced Footer for Errors */}
      {(failedImages.length > 0 || uploadError) && (
        <footer className="border-t border-border/20 px-6 py-4 bg-muted/20">
          <div className="space-y-3">
            {failedImages.length > 0 && (
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="text-sm text-destructive">
                  {failedImages.length} image{failedImages.length > 1 ? "s" : ""} failed to process
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {failedImages.slice(0, 3).map((img) => (
                    <Button
                      key={img._id}
                      size="sm"
                      variant="outline"
                      onClick={() => handleRetryFailed(img._id)}
                      className="text-xs h-7"
                    >
                      Retry Image {img._id.slice(-4)}
                    </Button>
                  ))}
                  {failedImages.length > 3 && (
                    <span className="text-xs text-muted-foreground">
                      +{failedImages.length - 3} more
                    </span>
                  )}
                </div>
              </div>
            )}
            {uploadError && (
              <div className="flex items-center gap-3">
                <div className="text-sm text-destructive flex-1">{uploadError}</div>
                {uploadError.includes("Load failed") && (
                  <Button size="sm" variant="outline" onClick={retryUpload} className="text-xs h-7">
                    Retry Upload
                  </Button>
                )}
              </div>
            )}
          </div>
        </footer>
      )}
    </div>
  );
}
