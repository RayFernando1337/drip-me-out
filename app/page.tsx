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

  const imageInput = useRef<HTMLInputElement>(null);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const imagesData = useQuery(api.images.getImages);
  const images = useMemo(() => imagesData || [], [imagesData]);
  const [isCapturing, setIsCapturing] = useState(false);

  const [displayedImages, setDisplayedImages] = useState<typeof images>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const IMAGES_PER_PAGE = 12;

  const prevGeneratedLengthRef = useRef<number>(0);

  const generatedImages = useMemo(() => {
    return images.filter((img) => img.isGenerated);
  }, [images]);

  const hasActiveGenerations = useMemo(() => {
    return images.some(
      (img) => img.generationStatus === "pending" || img.generationStatus === "processing"
    );
  }, [images]);

  useEffect(() => {
    const currentGeneratedLength = generatedImages.length;
    if (currentGeneratedLength !== prevGeneratedLengthRef.current) {
      const uniqueImages = generatedImages.filter((img, index, arr) =>
        arr.findIndex((item) => item._id === img._id) === index
      );
      setDisplayedImages(uniqueImages.slice(0, IMAGES_PER_PAGE));
      setCurrentPage(0);
      prevGeneratedLengthRef.current = currentGeneratedLength;
    }
  }, [generatedImages]);

  useEffect(() => {
    if (generatedImages.length > 0 && displayedImages.length === 0) {
      const uniqueImages = generatedImages.filter((img, index, arr) =>
        arr.findIndex((item) => item._id === img._id) === index
      );
      setDisplayedImages(uniqueImages.slice(0, IMAGES_PER_PAGE));
      setCurrentPage(0);
    }
  }, [generatedImages.length, displayedImages.length, generatedImages]);

  const handleLoadMore = useCallback(() => {
    if (isLoadingMore) return;
    const uniqueGeneratedImages = generatedImages.filter((img, index, arr) =>
      arr.findIndex((item) => item._id === img._id) === index
    );
    const totalImages = uniqueGeneratedImages.length;
    const nextPage = currentPage + 1;
    const startIndex = nextPage * IMAGES_PER_PAGE;
    const endIndex = Math.min(startIndex + IMAGES_PER_PAGE, totalImages);
    if (startIndex < totalImages) {
      setIsLoadingMore(true);
      const newImages = uniqueGeneratedImages.slice(startIndex, endIndex);
      setDisplayedImages((prev) => {
        const combined = [...prev, ...newImages];
        return combined.filter((img, index, arr) =>
          arr.findIndex((item) => item._id === img._id) === index
        );
      });
      setCurrentPage(nextPage);
      setIsLoadingMore(false);
    }
  }, [generatedImages, currentPage, isLoadingMore]);

  const isQuotaError = (error: unknown): boolean => {
    const errorMessage = error instanceof Error ? error.message : String(error || "");
    return (
      errorMessage.includes("quota") ||
      errorMessage.includes("RESOURCE_EXHAUSTED") ||
      errorMessage.includes("rate limit") ||
      errorMessage.includes("429")
    );
  };

  const handleImageCapture = async (imageData: string) => {
    setIsCapturing(true);
    try {
      const response = await fetch(imageData);
      const blob = await response.blob();
      const file = new File([blob], `capture-${Date.now()}.jpg`, { type: "image/jpeg" });
      const uploadUrl = await generateUploadUrl();
      const uploadResult = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!uploadResult.ok) {
        throw new Error(`Upload failed: ${uploadResult.statusText}`);
      }
      const { storageId } = await uploadResult.json();
      setIsGenerating(true);
      try {
        await scheduleImageGeneration({ storageId });
        toast.success("Image Generation Started!", {
          description: "You can refresh the page, generation will continue in the background.",
          duration: 4000,
        });
      } catch (genError) {
        if (isQuotaError(genError)) {
          toast.error("Gemini API Quota Exceeded", {
            description:
              "You've reached your daily/monthly limit. Try again later or upgrade your plan.",
            duration: 8000,
            action: {
              label: "Learn More",
              onClick: () => window.open("https://ai.google.dev/gemini-api/docs/rate-limits", "_blank"),
            },
          });
        } else {
          toast.error("Failed to Start Generation", {
            description: "Failed to schedule image generation. Please try again.",
            duration: 5000,
          });
        }
      } finally {
        setIsGenerating(false);
      }
    } catch (error) {
      console.error("Failed to upload captured image:", error);
    } finally {
      setIsCapturing(false);
    }
  };

  const handleSendImage = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedImage) return;
    setIsUploading(true);
    try {
      const uploadUrl = await generateUploadUrl();
      const result = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": selectedImage.type },
        body: selectedImage,
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
      } catch (genError) {
        if (isQuotaError(genError)) {
          toast.error("Gemini API Quota Exceeded", {
            description:
              "You've reached your daily/monthly limit. Try again later or upgrade your plan.",
            duration: 8000,
            action: {
              label: "Learn More",
              onClick: () => window.open("https://ai.google.dev/gemini-api/docs/rate-limits", "_blank"),
            },
          });
        } else {
          toast.error("Failed to Start Generation", {
            description: "Failed to schedule image generation. Please try again.",
            duration: 5000,
          });
        }
      } finally {
        setIsGenerating(false);
      }
      setSelectedImage(null);
      if (imageInput.current) imageInput.current.value = "";
    } catch (error) {
      console.error("Upload failed:", error);
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
                {/* <TabsTrigger value="upload" className="text-sm font-medium">📤 Upload</TabsTrigger> */}
              </TabsList>
              <TabsContent value="upload" className="mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Upload Image</CardTitle>
                  </CardHeader>
                    <CardContent className="flex-1 flex flex-col justify-center">
                      <div className="space-y-4">
                        <Input
                          type="file"
                          accept="image/*"
                          ref={imageInput}
                          onChange={(event) => setSelectedImage(event.target.files![0])}
                          disabled={selectedImage !== null}
                          className="w-full"
                        />
                        <Button
                          type="submit"
                          onClick={handleSendImage}
                          size="sm"
                          variant="outline"
                          className="w-full h-11"
                          disabled={isUploading || isGenerating || !selectedImage}
                        >
                          {isUploading
                            ? "Uploading..."
                            : isGenerating
                            ? "Generating..."
                            : "Upload & Generate"}
                        </Button>
                      </div>
                    </CardContent>
                </Card>
              </TabsContent>
              <TabsContent value="camera" className="mt-4">
                <div className="w-full">
                  <Webcam onCapture={handleImageCapture} isUploading={isCapturing || isGenerating} />
                </div>
              </TabsContent>
            </Tabs>
          </div>
          <div className="w-full">
            <ImagePreview
              images={displayedImages}
              totalImages={generatedImages.length}
              currentPage={currentPage}
              imagesPerPage={IMAGES_PER_PAGE}
              onLoadMore={handleLoadMore}
              hasMore={displayedImages.length < generatedImages.length}
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
