"use client";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import Image from "next/image";
import { useState } from "react";
import { toast } from "sonner";

type FeaturedImagesResult = NonNullable<
  ReturnType<typeof useQuery<typeof api.admin.getAdminFeaturedImages>>
>;
type FeaturedImage = FeaturedImagesResult["page"][number];

export default function AdminModerationDashboard() {
  const [paginationOpts, setPaginationOpts] = useState({
    numItems: 20,
    cursor: null as string | null,
  });
  const featuredImages = useQuery(api.admin.getAdminFeaturedImages, { paginationOpts });
  const disableImage = useMutation(api.admin.disableFeaturedImage);
  const enableImage = useMutation(api.admin.enableFeaturedImage);
  const deleteImage = useMutation(api.images.deleteImage);
  const [disableReason, setDisableReason] = useState("");
  const [selectedImageId, setSelectedImageId] = useState<Id<"images"> | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FeaturedImage | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDisableImage = async (imageId: Id<"images">) => {
    await disableImage({ imageId, reason: disableReason || "Policy violation" });
    setSelectedImageId(null);
    setDisableReason("");
  };

  const handleEnableImage = async (imageId: Id<"images">) => {
    await enableImage({ imageId });
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const result = await deleteImage({
        imageId: deleteTarget._id as Id<"images">,
        includeGenerated: true,
      });

      if (result.deletedTotal === 0) {
        toast.info("Already deleted", {
          description: "This image was no longer present in storage or the database.",
        });
      } else {
        const originalCount = result.deletedTotal - result.deletedGenerated;
        const segments: string[] = [];
        if (originalCount > 0) {
          segments.push(`${originalCount} original${originalCount === 1 ? "" : "s"}`);
        }
        if (result.deletedGenerated > 0) {
          segments.push(
            `${result.deletedGenerated} generated version${result.deletedGenerated === 1 ? "" : "s"}`
          );
        }
        const descriptionParts = segments.length > 0 ? `Removed ${segments.join(" and ")}.` : undefined;
        toast.success("Image deleted", {
          description: result.actedAsAdmin
            ? `${descriptionParts ?? "Deletion completed."} The user can no longer access this photo.`
            : descriptionParts ?? "Deletion completed.",
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to delete image";
      toast.error(message);
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
    }
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
                  <Button
                    onClick={() => {
                      setSelectedImageId(null);
                      setDeleteTarget(image);
                    }}
                    variant="destructive"
                    size="sm"
                    className="ml-auto"
                  >
                    Delete
                  </Button>
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

      {deleteTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full space-y-4">
            <h3 className="text-lg font-semibold text-destructive">Delete User&apos;s Image?</h3>
            <p className="text-sm text-muted-foreground">
              This will permanently remove this user&apos;s image and all generated versions. This action cannot be undone.
            </p>
            <div className="rounded-md border border-border/20 bg-muted/30 p-3 text-xs text-muted-foreground">
              <div>User ID: {deleteTarget.userId || "Unknown"}</div>
              <div>Image ID: {deleteTarget._id}</div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                onClick={() => {
                  if (!isDeleting) setDeleteTarget(null);
                }}
                variant="outline"
                disabled={isDeleting}
              >
                Keep Image
              </Button>
              <Button
                onClick={handleConfirmDelete}
                variant="destructive"
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
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Delete Image
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
