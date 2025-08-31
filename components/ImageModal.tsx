"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X, Copy, Check, Twitter, Share2 } from "lucide-react";
import { toast } from "sonner";

interface ImageModalProps {
  image: {
    _id: string;
    url: string;
    createdAt: number;
    generationStatus?: string;
  } | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function ImageModal({ image, isOpen, onClose }: ImageModalProps) {
  const [copied, setCopied] = useState(false);
  
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
        </div>
      </DialogContent>
    </Dialog>
  );
}