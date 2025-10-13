"use client";
import CreditBalance from "@/components/CreditBalance";
import CreditPurchaseModal from "@/components/CreditPurchaseModal";
import HeroGalleryDemo from "@/components/HeroGalleryDemo";
import ImagePreview from "@/components/ImagePreview";
import { Button } from "@/components/ui/button";
import Webcam from "@/components/Webcam";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { SignInButton, UserButton } from "@clerk/nextjs";
import { Authenticated, Unauthenticated, useMutation, useQuery } from "convex/react";
import { Camera, Sparkles, Upload } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

export default function Home() {
  return (
    <>
      <Authenticated>
        <Content />
      </Authenticated>
      <Unauthenticated>
        <div className="flex flex-col w-full min-h-screen">
          {/* Header for unauthenticated users - Dark theme */}
          <header className="sticky top-0 z-50 flex items-center justify-between w-full px-6 py-4 border-b border-white/10 bg-black/40 backdrop-blur-md">
            <div>
              <h1 className="text-2xl font-bold text-white">Anime Studio</h1>
              <p className="text-sm text-gray-300 mt-0.5">
                Transform objects into anime illustrations
              </p>
            </div>
            <SignInButton mode="modal">
              <button className="text-sm text-gray-300 hover:text-white transition-colors px-4 py-2 rounded-lg hover:bg-white/10">
                Sign in to start
              </button>
            </SignInButton>
          </header>

          {/* Main content for unauthenticated users */}
          <main className="flex-1">
            {/* Hero Gallery Scroll Animation */}
            <HeroGalleryDemo />
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
  const userCreditsData = useQuery(api.users.getCurrentUserCredits);

  // Memoize credit-derived values to avoid unnecessary re-renders
  const userCredits = useMemo(() => userCreditsData, [userCreditsData]);
  const canUpload = useMemo(() => userCredits && userCredits.credits > 0, [userCredits]);
  const isLoadingCredits = useMemo(() => userCredits === undefined, [userCredits]);

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
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);

  // Pagination state - base page size; adjusted dynamically to keep 4-column rows filled
  const [paginationOpts, setPaginationOpts] = useState<{
    numItems: number;
    cursor: string | null;
  }>({ numItems: 12, cursor: null });
  // Type for gallery images - infer from the paginated query
  type GalleryImageType = NonNullable<
    ReturnType<typeof useQuery<typeof api.images.getGalleryImagesPaginated>>
  >["page"][number];

  const [allGalleryImages, setAllGalleryImages] = useState<GalleryImageType[]>([]);

  // Use paginated query for better performance with proper memoization
  const galleryResultData = useQuery(api.images.getGalleryImagesPaginated, { paginationOpts });
  const totalImagesCountData = useQuery(api.images.getGalleryImagesCount);
  const failedImagesData = useQuery(api.images.getFailedImages);
  const hasActiveGenerationsData = useQuery(api.images.hasActiveGenerations);

  // Memoize query results to avoid unnecessary re-renders
  const galleryResult = useMemo(() => galleryResultData, [galleryResultData]);
  const totalImagesCount = useMemo(() => totalImagesCountData || 0, [totalImagesCountData]);
  const failedImages = useMemo(() => failedImagesData || [], [failedImagesData]);
  const hasActiveGenerations = useMemo(
    () => hasActiveGenerationsData || false,
    [hasActiveGenerationsData]
  );

  // Handle pagination results with proper reactivity
  useEffect(() => {
    if (galleryResult?.page) {
      setAllGalleryImages((prev) => {
        if (paginationOpts.cursor === null) {
          // First page - replace all images (handles new generations AND deletions)
          return galleryResult.page;
        } else {
          // Additional pages - append to existing images, avoiding duplicates
          const existingIds = new Set(prev.map((img) => img._id));
          const newImages = galleryResult.page.filter((img) => !existingIds.has(img._id));
          return [...prev, ...newImages];
        }
      });
    }
  }, [galleryResult, paginationOpts.cursor]);

  // Track total count to detect external additions (no hard reset on decreases)
  const prevTotalCount = useRef(totalImagesCount);
  useEffect(() => {
    // If total count increases and we're on first page, Convex reactivity will refresh
    prevTotalCount.current = totalImagesCount;
  }, [totalImagesCount]);

  // Auto-refresh when new images complete (reactive to total count changes)
  useEffect(() => {
    if (totalImagesCount > allGalleryImages.length && paginationOpts.cursor === null) {
      // New images detected and we're on first page - this triggers fresh data fetch
      // Convex reactivity will automatically refresh galleryResult
    }
  }, [totalImagesCount, allGalleryImages.length, paginationOpts.cursor]);

  // Load more function
  const loadMoreImages = useCallback(() => {
    if (galleryResult?.continueCursor && !galleryResult.isDone) {
      const currentCount = allGalleryImages.length;
      const remainder = currentCount % 4;
      const fill = remainder === 0 ? 0 : 4 - remainder;
      const base = 12;
      const numItems = base + fill; // ensure new total ends as multiple of 4
      setPaginationOpts({
        numItems,
        cursor: galleryResult.continueCursor,
      });
    }
  }, [galleryResult, allGalleryImages.length]);

  // Reset pagination when new images are uploaded
  const resetPagination = useCallback(() => {
    setPaginationOpts({ numItems: 12, cursor: null });
    setAllGalleryImages([]);
  }, []);

  // Handle local deletion to avoid full reset and preserve scroll position
  const handleDeleted = useCallback(
    (imageId: Id<"images">) => {
      setAllGalleryImages((prev) => prev.filter((img) => img._id !== imageId));

      // Top-off to keep rows filled if more items are available
      if (galleryResult?.continueCursor && !galleryResult.isDone) {
        const nextCount = allGalleryImages.length - 1;
        const remainder = ((nextCount % 4) + 4) % 4;
        const fill = remainder === 0 ? 0 : 4 - remainder;
        if (fill > 0) {
          setPaginationOpts({ numItems: fill, cursor: galleryResult.continueCursor });
        }
      }
    },
    [galleryResult, allGalleryImages.length]
  );

  // Memoize gallery images for stable references
  const galleryImages = useMemo(() => allGalleryImages || [], [allGalleryImages]);

  // Auto-top-off after merges if last row is incomplete and more items exist
  const lastAutoFillCursorRef = useRef<string | null>(null);
  useEffect(() => {
    const remainder = allGalleryImages.length % 4;
    const canContinue = !!galleryResult?.continueCursor && !galleryResult.isDone;
    if (remainder > 0 && canContinue) {
      const cursor = galleryResult!.continueCursor as string;
      if (lastAutoFillCursorRef.current !== cursor) {
        lastAutoFillCursorRef.current = cursor;
        const fill = 4 - remainder;
        setPaginationOpts({ numItems: fill, cursor });
      }
    } else if (remainder === 0) {
      lastAutoFillCursorRef.current = null;
    }
  }, [allGalleryImages.length, galleryResult]);

  // Map low-level errors to friendly, user-facing messages
  const toUserMessage = useCallback((error: unknown): string => {
    const msg = error instanceof Error ? error.message : String(error || "");
    if (msg.includes("Load failed") || msg.includes("Network") || msg.includes("Failed to fetch")) {
      return "Network issue during upload. Please check your connection and try again.";
    }
    if (msg.startsWith("VALIDATION:")) {
      return msg.replace(/^VALIDATION:\s*/, "");
    }
    if (msg.startsWith("INSUFFICIENT_CREDITS:")) {
      return msg.replace(/^INSUFFICIENT_CREDITS:\s*/, "");
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

            // Show credit usage feedback with updated balance
            const remainingCredits = Math.max(0, (userCredits?.credits || 0) - 1);
            toast.success("Transformation started", {
              description: `Using 1 credit. ${remainingCredits} credit${remainingCredits !== 1 ? "s" : ""} remaining.`,
              duration: 4000, // Show longer to let user see the updated balance
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
        const errorMsg = error instanceof Error ? error.message : String(error || "");

        // If it's an insufficient credits error, show the purchase modal
        if (errorMsg.startsWith("INSUFFICIENT_CREDITS:")) {
          setShowPurchaseModal(true);
          toast.error("No Credits Available", {
            description: "You need credits to generate images. Each transformation uses 1 credit.",
            duration: 5000,
          });
        } else {
          setUploadError(msg);
          toast.error("Upload failed", { description: msg });
        }
        return false; // Failed
      } finally {
        setIsPreparing(false);
        setIsUploading(false);
      }
    },
    [
      generateUploadUrl,
      uploadAndScheduleGeneration,
      toUserMessage,
      resetPagination,
      userCredits?.credits,
    ]
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
      {/* Sticky Header with Auth */}
      <header className="sticky top-0 z-40 flex items-center justify-between w-full px-6 py-4 border-b border-border/20 bg-background/95 backdrop-blur-sm">
        <div className="flex items-center gap-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Anime Studio</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Transform objects into anime illustrations
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Unified Credit UI - either clickable balance (when 0) or separate button */}
          {userCredits?.credits === 0 ? (
            <CreditPurchaseModal>
              <CreditBalance />
            </CreditPurchaseModal>
          ) : (
            <>
              <CreditBalance />
              <CreditPurchaseModal>
                <Button variant="outline" size="sm">
                  Buy Credits
                </Button>
              </CreditPurchaseModal>
            </>
          )}
          {/* Desktop Webcam Toggle */}
          <div className="hidden md:flex items-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowDesktopCamera(!showDesktopCamera)}
              disabled={!canUpload}
              className={`flex items-center gap-2 ${
                !canUpload
                  ? "text-muted-foreground/50"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Camera className="w-4 h-4" />
              {showDesktopCamera ? "Hide Camera" : "Camera"}
            </Button>
          </div>

          <UserButton />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col">
        <div className="flex-1 px-6 py-6">
          {galleryImages.length === 0 && !hasActiveGenerations ? (
            /* Hero Empty State - Jony Ive Style */
            <div className="flex flex-col items-center justify-center h-full min-h-[70vh] px-4">
              {/* Inspiring Header */}
              <div className="text-center space-y-6 mb-12 max-w-2xl">
                <div className="w-20 h-20 mx-auto rounded-3xl bg-gradient-to-br from-purple-400 via-blue-500 to-indigo-600 flex items-center justify-center shadow-lg breathe">
                  <Upload className="w-10 h-10 text-white" />
                </div>
                <div className="space-y-3">
                  <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">
                    Bring your photos to life
                  </h2>
                  <p className="text-muted-foreground text-lg leading-relaxed">
                    Upload any image and watch objects transform into beautiful anime illustrations
                  </p>
                </div>
              </div>

              {/* Prominent Hero Drop Zone */}
              <div className="w-full max-w-4xl">
                <div
                  onDragOver={canUpload ? handleDragOver : undefined}
                  onDragLeave={canUpload ? handleDragLeave : undefined}
                  onDrop={canUpload ? handleDrop : undefined}
                  className={`
                    hero-drop-zone min-h-[280px] md:min-h-[360px] 
                    border-2 border-dashed rounded-3xl 
                    transition-all duration-300 ease-out
                    ${!isPreparing && !isUploading && canUpload ? "breathe cursor-pointer" : ""}
                    ${!canUpload ? "opacity-60 cursor-not-allowed" : ""}
                    ${
                      isDragOver && canUpload
                        ? "border-primary bg-gradient-to-br from-primary/10 to-purple-500/10 scale-[1.01] shadow-xl"
                        : canUpload
                          ? "border-border/40 hover:border-primary/40 hover:shadow-lg cursor-pointer"
                          : "border-border/30"
                    }
                    ${isPreparing || isUploading ? "opacity-50 cursor-not-allowed" : ""}
                  `}
                >
                  {/* Background gradient overlay */}
                  <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-muted/20 rounded-3xl pointer-events-none" />

                  <div className="relative flex flex-col items-center justify-center h-full p-8 md:p-16">
                    {isPreparing || isUploading ? (
                      <div className="text-center space-y-4">
                        <div className="w-12 h-12 mx-auto border-3 border-primary border-t-transparent rounded-full animate-spin" />
                        <div className="space-y-2">
                          <p className="font-medium text-foreground">
                            {isPreparing ? "Preparing image..." : "Uploading..."}
                          </p>
                          <p className="text-sm text-muted-foreground">This may take a moment</p>
                        </div>
                      </div>
                    ) : !canUpload ? (
                      <div className="text-center space-y-6">
                        <div className="w-12 h-12 mx-auto rounded-full bg-muted flex items-center justify-center">
                          <Sparkles className="w-6 h-6 text-muted-foreground" />
                        </div>
                        <div className="space-y-3">
                          <p className="text-xl md:text-2xl font-semibold text-muted-foreground">
                            {isLoadingCredits ? "Loading..." : "No Credits Available"}
                          </p>
                          <p className="text-muted-foreground">
                            {isLoadingCredits
                              ? "Checking your account..."
                              : "You need credits to generate images. Each transformation uses 1 credit."}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center space-y-6">
                        <Upload
                          className={`w-12 h-12 mx-auto transition-all duration-300 ${
                            isDragOver ? "text-primary scale-110" : "text-muted-foreground"
                          }`}
                        />
                        <div className="space-y-3">
                          <p
                            className={`text-xl md:text-2xl font-semibold transition-colors ${
                              isDragOver ? "text-primary" : "text-foreground"
                            }`}
                          >
                            {isDragOver ? "Drop your image here" : "Drag and drop your image"}
                          </p>
                          <p className="text-muted-foreground">
                            or click anywhere to browse • JPEG, PNG, HEIC supported
                            <br />
                            <span className="text-xs">Uses 1 credit per transformation</span>
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Full-area file input */}
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
                    disabled={isPreparing || isUploading || !canUpload}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                  />
                </div>

                {/* Subtle Camera Option */}
                <div className="flex items-center justify-center mt-8">
                  <button
                    type="button"
                    onClick={() => setShowMobileCamera(!showMobileCamera)}
                    disabled={!canUpload}
                    className={`flex items-center gap-2 transition-colors py-2 px-4 rounded-lg ${
                      !canUpload
                        ? "text-muted-foreground/50 cursor-not-allowed"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    }`}
                  >
                    <Camera className="w-4 h-4" />
                    <span className="text-sm font-medium">
                      {showMobileCamera ? "Hide camera" : "Use camera instead"}
                    </span>
                  </button>
                </div>

                {/* Mobile Camera */}
                {showMobileCamera && (
                  <div className="mt-8 p-6 bg-muted/20 rounded-2xl border border-border/30">
                    <Webcam onCapture={handleImageCapture} isUploading={isCapturing} />
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Gallery Display */
            <div className="space-y-6">
              {/* Gallery Header with Prominent Upload */}
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-semibold">Your Transformations</h2>
                    <p className="text-sm text-muted-foreground">
                      {totalImagesCount} images transformed
                    </p>
                  </div>
                </div>

                {/* Prominent Gallery Drop Zone */}
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`
                    gallery-drop-zone w-full h-24 md:h-24 
                    border-2 border-dashed rounded-2xl 
                    transition-all duration-300 ease-out cursor-pointer
                    ${
                      isDragOver
                        ? "border-primary bg-gradient-to-r from-primary/15 to-blue-500/15 scale-[1.01] shadow-lg"
                        : "border-border/50 hover:border-primary/60 hover:shadow-md"
                    }
                    ${isPreparing || isUploading ? "opacity-50 cursor-not-allowed" : ""}
                  `}
                >
                  <div className="absolute inset-0 flex items-center justify-center">
                    {isPreparing || isUploading ? (
                      <div className="flex items-center gap-3">
                        <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                        <span className="font-medium text-foreground">
                          {isPreparing ? "Preparing..." : "Uploading..."}
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        <Upload
                          className={`w-5 h-5 transition-all duration-300 ${
                            isDragOver ? "text-primary scale-110" : "text-muted-foreground"
                          }`}
                        />
                        <span
                          className={`font-medium transition-colors ${
                            isDragOver ? "text-primary" : "text-foreground"
                          }`}
                        >
                          {isDragOver
                            ? "Drop your image here"
                            : "Drop image here or click to browse"}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Full-area file input */}
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
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                  />
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
                onDeleted={handleDeleted}
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

      {/* Controlled Purchase Modal for insufficient credits */}
      <CreditPurchaseModal open={showPurchaseModal} onOpenChange={setShowPurchaseModal}>
        <div />
      </CreditPurchaseModal>
    </div>
  );
}
