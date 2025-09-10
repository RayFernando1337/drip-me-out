"use client";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import Image from "next/image";
import { useState } from "react";

export default function AdminModerationDashboard() {
  const [paginationOpts, setPaginationOpts] = useState({
    numItems: 20,
    cursor: null as string | null,
  });
  const featuredImages = useQuery(api.admin.getAdminFeaturedImages, { paginationOpts });
  const disableImage = useMutation(api.admin.disableFeaturedImage);
  const enableImage = useMutation(api.admin.enableFeaturedImage);
  const [disableReason, setDisableReason] = useState("");
  const [selectedImageId, setSelectedImageId] = useState<Id<"images"> | null>(null);

  const handleDisableImage = async (imageId: Id<"images">) => {
    await disableImage({ imageId, reason: disableReason || "Policy violation" });
    setSelectedImageId(null);
    setDisableReason("");
  };

  const handleEnableImage = async (imageId: Id<"images">) => {
    await enableImage({ imageId });
  };

  return (
    <div className="space-y-8 p-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-semibold">Featured Images Moderation</h2>
        <p className="text-muted-foreground">Review and moderate public gallery images</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {featuredImages?.page.map((image) => (
          <div key={image._id} className="group">
            <div
              className={`bg-card border transition-all duration-200 overflow-hidden rounded-xl shadow-sm ${
                image.isDisabledByAdmin
                  ? "border-red-500 bg-red-50 dark:bg-red-900/20"
                  : "border-border/30 hover:border-border hover:shadow-md"
              }`}
            >
              <div className="aspect-square relative">
                <Image
                  src={image.url}
                  alt="Featured transformation"
                  fill
                  className="object-cover"
                  sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
                />
                <div className="absolute top-2 left-2">
                  {image.isDisabledByAdmin ? (
                    <div className="bg-red-500 text-white text-xs px-2 py-1 rounded-full">
                      Disabled
                    </div>
                  ) : (
                    <div className="bg-green-500 text-white text-xs px-2 py-1 rounded-full">
                      Live
                    </div>
                  )}
                </div>
              </div>
              <div className="p-4 space-y-3">
                <div className="text-xs text-muted-foreground">
                  User: {image.userId || "Unknown"}
                </div>
                {image.isDisabledByAdmin && image.disabledByAdminReason && (
                  <div className="text-xs text-red-600 bg-red-50 dark:bg-red-900/20 p-2 rounded">
                    <strong>Disabled:</strong> {image.disabledByAdminReason}
                  </div>
                )}
                <div className="flex gap-2">
                  {image.isDisabledByAdmin ? (
                    <Button
                      onClick={() => handleEnableImage(image._id)}
                      variant="outline"
                      size="sm"
                      className="text-green-600 border-green-600 hover:bg-green-50"
                    >
                      Re-enable
                    </Button>
                  ) : (
                    <Button
                      onClick={() => setSelectedImageId(image._id)}
                      variant="outline"
                      size="sm"
                      className="text-red-600 border-red-600 hover:bg-red-50"
                    >
                      Disable
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {featuredImages?.continueCursor && !featuredImages.isDone && (
        <div className="flex justify-center">
          <Button
            onClick={() =>
              setPaginationOpts({ numItems: 20, cursor: featuredImages.continueCursor })
            }
            variant="ghost"
          >
            Load More Images
          </Button>
        </div>
      )}

      {selectedImageId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full space-y-4">
            <h3 className="text-lg font-semibold">Disable Featured Image</h3>
            <p className="text-sm text-muted-foreground">
              This removes the image from the public gallery. Provide a reason:
            </p>
            <textarea
              value={disableReason}
              onChange={(e) => setDisableReason(e.target.value)}
              placeholder="Reason for disabling"
              className="w-full p-3 border rounded-md"
              rows={3}
            />
            <div className="flex gap-2 justify-end">
              <Button
                onClick={() => {
                  setSelectedImageId(null);
                  setDisableReason("");
                }}
                variant="ghost"
              >
                Cancel
              </Button>
              <Button
                onClick={() => handleDisableImage(selectedImageId)}
                disabled={!disableReason.trim()}
                variant="destructive"
              >
                Disable Image
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
