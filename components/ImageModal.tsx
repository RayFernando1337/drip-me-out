"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Copy,
  Settings,
  Share2,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { ImageWithFallback } from "./ui/ImageWithFallback";

// Infer the type from the actual query return type
type ImageFromQuery = NonNullable<ReturnType<typeof useQuery<typeof api.images.getImages>>>[number];
type ImageWithFeatured = ImageFromQuery & {
  isFeatured?: boolean;
  isDisabledByAdmin?: boolean;
  disabledByAdminReason?: string;
};

interface ImageModalProps {
  images: ImageFromQuery[];
  selectedImageIndex: number | null;
  isOpen: boolean;
  onClose: () => void;
  onImageIndexChange?: (index: number) => void;
  onDeleted?: (imageId: Id<"images">) => void;
}

export default function ImageModal({
  images,
  selectedImageIndex,
  isOpen,
  onClose,
  onImageIndexChange,
  onDeleted,
}: ImageModalProps) {
  const currentImage = selectedImageIndex !== null ? images[selectedImageIndex] : null;

  const [copied, setCopied] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [sharingEnabled, setSharingEnabled] = useState(currentImage?.sharingEnabled !== false);
  const [isFeatured, setIsFeatured] = useState<boolean>(
    (currentImage as ImageWithFeatured | null)?.isFeatured === true &&
      (currentImage as ImageWithFeatured | null)?.isDisabledByAdmin !== true
  );
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Update state when image prop changes
  useEffect(() => {
    setSharingEnabled(currentImage?.sharingEnabled !== false);
    const extended = currentImage as ImageWithFeatured | null;
    const lockedByAdmin = extended?.isDisabledByAdmin === true;
    setIsFeatured(extended?.isFeatured === true && !lockedByAdmin);
  }, [currentImage]);

  // Navigation state helpers
  const canNavigate = !!onImageIndexChange && selectedImageIndex !== null && images.length > 1;
  const hasPrevious = canNavigate && (selectedImageIndex as number) > 0;
  const hasNext = canNavigate && (selectedImageIndex as number) < images.length - 1;

  // Navigation functions
  const goToPrevious = useCallback(() => {
    if (hasPrevious && onImageIndexChange) {
      onImageIndexChange((selectedImageIndex as number) - 1);
    }
  }, [hasPrevious, onImageIndexChange, selectedImageIndex]);

  const goToNext = useCallback(() => {
    if (hasNext && onImageIndexChange) {
      onImageIndexChange((selectedImageIndex as number) + 1);
    }
  }, [hasNext, onImageIndexChange, selectedImageIndex]);

  // Keyboard navigation (only when navigation is enabled)
  useEffect(() => {
    if (!isOpen || !canNavigate) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      switch (event.key) {
        case "ArrowLeft":
          event.preventDefault();
          goToPrevious();
          break;
        case "ArrowRight":
          event.preventDefault();
          goToNext();
          break;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, canNavigate, goToPrevious, goToNext]);
  const updateShareSettings = useMutation(api.images.updateShareSettings);
  const updateFeaturedStatus = useMutation(api.images.updateFeaturedStatus);
  const deleteImageMutation = useMutation(api.images.deleteImage);

  if (!currentImage) return null;

  const extendedImage = currentImage as ImageWithFeatured;
  const isAdminLocked = extendedImage?.isDisabledByAdmin === true;
  const adminLockReason = extendedImage?.disabledByAdminReason?.trim();
  const adminLockMessage = adminLockReason
    ? `Removed by moderators: ${adminLockReason}`
    : "Removed by moderators. Contact support to request reinstatement.";
  const intrinsicWidth = currentImage.originalWidth ?? 1024;
  const intrinsicHeight = currentImage.originalHeight ?? 1024;

  const handleShare = async () => {
    const shareUrl = `${process.env.NEXT_PUBLIC_SITE_URL || window.location.origin}/share/${currentImage._id}`;

    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success("Link copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy link");
    }
  };

  const handleTwitterShare = () => {
    const shareUrl = `${process.env.NEXT_PUBLIC_SITE_URL || window.location.origin}/share/${currentImage._id}`;
    const text = "Check out my anime transformation! Created with @RayFernando1337 🎨✨";
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(shareUrl)}`;
    window.open(twitterUrl, "_blank");
  };

  const handleFeaturedToggle = async (enabled: boolean) => {
    if (isAdminLocked && enabled) {
      setIsFeatured(false);
      toast.error(adminLockMessage);
      return;
    }

    setIsFeatured(enabled);
    try {
      await updateFeaturedStatus({
        imageId: currentImage._id as Id<"images">,
        isFeatured: enabled,
      });
      toast.success(enabled ? "Added to public gallery" : "Removed from public gallery");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to update featured status";
      toast.error(message);
      setIsFeatured(!enabled);
    }
  };

  const handleNativeShare = async () => {
    const shareUrl = `${window.location.origin}/share/${currentImage._id}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: "My Anime Transformation",
          text: "Check out my anime transformation!",
          url: shareUrl,
        });
      } catch {
        // User cancelled or error - do nothing
        console.log("Share cancelled");
      }
    }
  };

  const handleSharingToggle = async (enabled: boolean) => {
    setSharingEnabled(enabled);
    try {
      await updateShareSettings({
        imageId: currentImage._id as Id<"images">,
        sharingEnabled: enabled,
      });
      toast.success(enabled ? "Sharing enabled" : "Sharing disabled");
    } catch {
      toast.error("Failed to update sharing settings");
      setSharingEnabled(!enabled); // Revert on error
    }
  };

  const handleExpirationChange = async (value: string) => {
    const hours = value === "never" ? 0 : parseInt(value);
    try {
      await updateShareSettings({
        imageId: currentImage._id as Id<"images">,
        sharingEnabled: true,
        expirationHours: hours || undefined,
      });
      setSharingEnabled(true);
      toast.success("Expiration updated");
    } catch {
      toast.error("Failed to update expiration");
    }
  };

  const getExpirationValue = () => {
    if (!currentImage.shareExpiresAt) return "never";
    const hoursLeft = Math.floor((currentImage.shareExpiresAt - Date.now()) / (1000 * 60 * 60));
    if (hoursLeft <= 24) return "24";
    if (hoursLeft <= 168) return "168";
    if (hoursLeft <= 720) return "720";
    return "never";
  };

  const handleDelete = async () => {
    if (!currentImage) return;

    setIsDeleting(true);
    try {
      await deleteImageMutation({ imageId: currentImage._id });
      toast.success("Image deleted", {
        description: "The image and its generated versions were removed.",
      });
      // Inform parent so it can update local state without resetting pagination/scroll
      onDeleted?.(currentImage._id as Id<"images">);
      setIsDeleteDialogOpen(false);
      onClose();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to delete image";
      toast.error(message);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-5xl w-[min(96vw,960px)] overflow-y-auto p-0 md:overflow-hidden">
        <div className="flex h-full flex-col md:max-h-[90vh] md:flex-row">
          <div className="relative flex-1 bg-black/5">
            <div className="flex h-[min(60vh,420px)] w-full items-center justify-center p-4 md:h-full md:min-h-[520px]">
              <ImageWithFallback
                src={currentImage.url}
                alt="Full size image"
                width={intrinsicWidth}
                height={intrinsicHeight}
                className="h-auto w-full max-h-[min(60vh,420px)] md:max-h-[80vh] object-contain"
                sizes="(max-width: 768px) 100vw, (max-width: 1024px) 60vw, 640px"
                style={{ width: "100%", height: "auto" }}
                priority={true}
                placeholder={currentImage.placeholderBlurDataUrl ? "blur" : "empty"}
                blurDataURL={currentImage.placeholderBlurDataUrl}
              />

              {/* Navigation buttons (only when navigation is enabled) */}
              {hasPrevious && (
                <Button
                  variant="secondary"
                  size="sm"
                  className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white border-0 rounded-full w-10 h-10 p-0 shadow-lg"
                  onClick={goToPrevious}
                  aria-label="Previous image"
                >
                  <ChevronLeft className="w-5 h-5" />
                </Button>
              )}

              {hasNext && (
                <Button
                  variant="secondary"
                  size="sm"
                  className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white border-0 rounded-full w-10 h-10 p-0 shadow-lg"
                  onClick={goToNext}
                  aria-label="Next image"
                >
                  <ChevronRight className="w-5 h-5" />
                </Button>
              )}

              {/* Image counter */}
              {canNavigate && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/50 text-white px-3 py-1 rounded-full text-sm font-medium">
                  {selectedImageIndex !== null
                    ? `${selectedImageIndex + 1} of ${images.length}`
                    : ""}
                </div>
              )}
            </div>
          </div>
          <div className="flex flex-1 flex-col bg-background md:w-[360px] md:max-w-sm md:border-l md:border-border/50">
            <DialogHeader className="space-y-2 px-6 pt-6 text-left">
              <DialogTitle>Image Preview</DialogTitle>
              <DialogDescription>
                Created {new Date(currentImage.createdAt).toLocaleDateString()}
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto px-6 pb-6 pt-4">
              <div className="grid w-full gap-2 sm:grid-cols-2">
                <Button
                  onClick={handleShare}
                  className="flex w-full items-center justify-center gap-2 sm:col-span-2"
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copied ? "Copied!" : "Copy Share Link"}
                </Button>
                <Button
                  onClick={handleTwitterShare}
                  variant="outline"
                  className="flex w-full items-center justify-center gap-2"
                >
                  Share on X
                </Button>
                {typeof navigator !== "undefined" && "share" in navigator && (
                  <Button
                    onClick={handleNativeShare}
                    variant="outline"
                    className="flex w-full items-center justify-center gap-2"
                  >
                    <Share2 className="h-4 w-4" />
                    Share
                  </Button>
                )}
              </div>

              <div className="mt-6 border-t pt-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowSettings(!showSettings)}
                  className="w-full justify-between"
                >
                  <span className="flex items-center gap-2">
                    <Settings className="h-4 w-4" />
                    Share Settings
                  </span>
                  {showSettings ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </Button>

                {showSettings && (
                  <div className="mt-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <label htmlFor="sharing-toggle" className="text-sm font-medium">
                        Enable Sharing
                      </label>
                      <Switch
                        id="sharing-toggle"
                        checked={sharingEnabled}
                        onCheckedChange={handleSharingToggle}
                      />
                    </div>

                    {sharingEnabled && (
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Link Expiration</label>
                        <Select
                          onValueChange={handleExpirationChange}
                          defaultValue={getExpirationValue()}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="24">24 hours</SelectItem>
                            <SelectItem value="168">7 days</SelectItem>
                            <SelectItem value="720">30 days</SelectItem>
                            <SelectItem value="never">Never expire</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {!sharingEnabled && (
                      <p className="text-sm text-muted-foreground">
                        When sharing is disabled, your image link will not be accessible to others.
                      </p>
                    )}

                    <div className="flex items-center justify-between pt-2">
                      <div className="space-y-1 text-left">
                        <label className="text-sm font-medium">Feature in Public Gallery</label>
                        <p className="text-xs text-muted-foreground">
                          Showcase your transformation to inspire others
                        </p>
                      </div>
                      <Switch
                        checked={isFeatured}
                        onCheckedChange={handleFeaturedToggle}
                        disabled={isAdminLocked}
                      />
                    </div>
                    {isAdminLocked && (
                      <p className="text-xs text-destructive/80">{adminLockMessage}</p>
                    )}

                    <div className="border-t pt-4">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="space-y-1">
                            <h3 className="text-sm font-medium text-destructive">Danger Zone</h3>
                            <p className="text-xs text-muted-foreground">
                              Permanently delete this image and all versions
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => setIsDeleteDialogOpen(true)}
                          className="w-full flex items-center gap-2"
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete Image
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>

      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Delete Image?
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              This will permanently remove this image and all generated versions. This cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:justify-end sm:space-x-2">
            <DialogClose asChild>
              <Button variant="outline" disabled={isDeleting}>
                Keep Image
              </Button>
            </DialogClose>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
              className="flex items-center gap-2"
            >
              {isDeleting ? (
                <span className="flex items-center gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Deleting...
                </span>
              ) : (
                <>
                  <Trash2 className="h-4 w-4" /> Delete Image
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
