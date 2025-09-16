"use client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import { Check, ChevronDown, ChevronUp, Copy, Settings, Share2, X } from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";
import { toast } from "sonner";

// Infer the type from the actual query return type
type ImageFromQuery = NonNullable<ReturnType<typeof useQuery<typeof api.images.getImages>>>[number];
type ImageWithFeatured = ImageFromQuery & {
  isFeatured?: boolean;
  isDisabledByAdmin?: boolean;
  disabledByAdminReason?: string;
};

interface ImageModalProps {
  image: ImageFromQuery | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function ImageModal({ image, isOpen, onClose }: ImageModalProps) {
  const [copied, setCopied] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [sharingEnabled, setSharingEnabled] = useState(image?.sharingEnabled !== false);
  const [isFeatured, setIsFeatured] = useState<boolean>(
    ((image as ImageWithFeatured | null)?.isFeatured) === true &&
      ((image as ImageWithFeatured | null)?.isDisabledByAdmin !== true)
  );

  // Update state when image prop changes
  useEffect(() => {
    setSharingEnabled(image?.sharingEnabled !== false);
    const extended = image as ImageWithFeatured | null;
    const lockedByAdmin = extended?.isDisabledByAdmin === true;
    setIsFeatured(extended?.isFeatured === true && !lockedByAdmin);
  }, [image]);
  const updateShareSettings = useMutation(api.images.updateShareSettings);
  const updateFeaturedStatus = useMutation(api.images.updateFeaturedStatus);

  if (!image) return null;

  const extendedImage = image as ImageWithFeatured;
  const isAdminLocked = extendedImage?.isDisabledByAdmin === true;
  const adminLockReason = extendedImage?.disabledByAdminReason?.trim();
  const adminLockMessage = adminLockReason
    ? `Removed by moderators: ${adminLockReason}`
    : "Removed by moderators. Contact support to request reinstatement.";

  const handleShare = async () => {
    const shareUrl = `${window.location.origin}/share/${image._id}`;

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
    const shareUrl = `${window.location.origin}/share/${image._id}`;
    const text = "Check out my AI-generated diamond chain photo! 💎⛓️";
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
        imageId: image._id as Id<"images">,
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
    const shareUrl = `${window.location.origin}/share/${image._id}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: "My Dripped Out Photo",
          text: "Check out my AI-generated diamond chain!",
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
        imageId: image._id as Id<"images">,
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
        imageId: image._id as Id<"images">,
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
    if (!image.shareExpiresAt) return "never";
    const hoursLeft = Math.floor((image.shareExpiresAt - Date.now()) / (1000 * 60 * 60));
    if (hoursLeft <= 24) return "24";
    if (hoursLeft <= 168) return "168";
    if (hoursLeft <= 720) return "720";
    return "never";
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0 overflow-hidden">
        <DialogHeader className="p-4 pb-0">
          <DialogTitle>Image Preview</DialogTitle>
          <DialogDescription>
            Created {new Date(image.createdAt).toLocaleDateString()}
          </DialogDescription>
        </DialogHeader>
        <div className="p-4">
          <div
            className="w-full rounded-lg mb-4 overflow-hidden"
            style={{ maxHeight: "calc(90vh - 180px)" }}
          >
            <Image
              src={image.url}
              alt="Full size image"
              width={800}
              height={600}
              className="w-full h-auto rounded-lg"
              style={{ objectFit: "contain", maxHeight: "calc(90vh - 180px)" }}
              unoptimized={true}
              priority={true}
            />
          </div>
          <div className="flex justify-center gap-2">
            <Button onClick={handleShare} className="flex items-center gap-2">
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? "Copied!" : "Copy Share Link"}
            </Button>
            <Button
              onClick={handleTwitterShare}
              variant="outline"
              className="flex items-center gap-2"
            >
              <X className="w-4 h-4" />
              Share on X
            </Button>
            {typeof navigator !== "undefined" && "share" in navigator && (
              <Button
                onClick={handleNativeShare}
                variant="outline"
                className="flex items-center gap-2"
              >
                <Share2 className="w-4 h-4" />
                Share
              </Button>
            )}
          </div>

          <div className="border-t pt-4 mt-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowSettings(!showSettings)}
              className="w-full justify-between"
            >
              <span className="flex items-center gap-2">
                <Settings className="w-4 h-4" />
                Share Settings
              </span>
              {showSettings ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
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

                {/* Feature in public gallery */}
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
                  <p className="text-xs text-destructive/80">
                    {adminLockMessage}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
