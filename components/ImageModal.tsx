"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X, Copy, Check, Twitter, Share2, Settings, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

interface ImageModalProps {
  image: {
    _id: string;
    url: string;
    createdAt: number;
    generationStatus?: string;
    sharingEnabled?: boolean;
    shareExpiresAt?: number;
  } | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function ImageModal({ image, isOpen, onClose }: ImageModalProps) {
  const [copied, setCopied] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [sharingEnabled, setSharingEnabled] = useState(image?.sharingEnabled !== false);
  const updateShareSettings = useMutation(api.images.updateShareSettings);
  
  if (!image) return null;
  
  const handleShare = async () => {
    const shareUrl = `${window.location.origin}/share/${image._id}`;
    
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success("Link copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error("Failed to copy link");
    }
  };

  const handleTwitterShare = () => {
    const shareUrl = `${window.location.origin}/share/${image._id}`;
    const text = "Check out my AI-generated diamond chain photo! 💎⛓️";
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(shareUrl)}`;
    window.open(twitterUrl, "_blank");
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
      } catch (err) {
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
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Created {new Date(image.createdAt).toLocaleDateString()}
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="rounded-full"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>
        <div className="p-4">
          <img
            src={image.url}
            alt="Full size image"
            className="w-full h-auto rounded-lg mb-4"
            style={{ maxHeight: "calc(90vh - 180px)", objectFit: "contain" }}
          />
          <div className="flex justify-center gap-2">
            <Button 
              onClick={handleShare} 
              className="flex items-center gap-2"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? "Copied!" : "Copy Share Link"}
            </Button>
            <Button 
              onClick={handleTwitterShare} 
              variant="outline"
              className="flex items-center gap-2"
            >
              <Twitter className="w-4 h-4" />
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
              {showSettings ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
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
                    <Select onValueChange={handleExpirationChange} defaultValue={getExpirationValue()}>
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
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}