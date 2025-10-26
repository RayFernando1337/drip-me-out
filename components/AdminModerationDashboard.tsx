"use client";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  const [activeTab, setActiveTab] = useState<"pending" | "approved">("pending");
  const [pendingPaginationOpts, setPendingPaginationOpts] = useState({
    numItems: 20,
    cursor: null as string | null,
  });
  const [approvedPaginationOpts, setApprovedPaginationOpts] = useState({
    numItems: 20,
    cursor: null as string | null,
  });
  const pendingImages = useQuery(api.admin.getPendingFeaturedImages, { paginationOpts: pendingPaginationOpts });
  const featuredImages = useQuery(api.admin.getAdminFeaturedImages, { paginationOpts: approvedPaginationOpts });
  const disableImage = useMutation(api.admin.disableFeaturedImage);
  const enableImage = useMutation(api.admin.enableFeaturedImage);
  const approveImage = useMutation(api.admin.approveFeaturedImage);
  const rejectImage = useMutation(api.admin.rejectFeaturedImage);
  const deleteImage = useMutation(api.images.deleteImage);
  const normalizeFeatured = useMutation(api.admin.normalizeFeaturedFlags);
  const [disableReason, setDisableReason] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [rejectTarget, setRejectTarget] = useState<FeaturedImage | null>(null);
  const [selectedImageId, setSelectedImageId] = useState<Id<"images"> | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FeaturedImage | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isNormalizing, setIsNormalizing] = useState(false);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());

  const handleDisableImage = async (imageId: Id<"images">) => {
    setProcessingIds(prev => new Set(prev).add(imageId));
    try {
      await disableImage({ imageId, reason: disableReason || "Policy violation" });
      toast.success("Image disabled", {
        description: "Image removed from public gallery",
      });
      setSelectedImageId(null);
      setDisableReason("");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to disable image";
      toast.error(message);
    } finally {
      setProcessingIds(prev => {
        const next = new Set(prev);
        next.delete(imageId);
        return next;
      });
    }
  };

  const handleEnableImage = async (imageId: Id<"images">) => {
    setProcessingIds(prev => new Set(prev).add(imageId));
    try {
      await enableImage({ imageId });
      toast.success("Image re-enabled", {
        description: "Image restored to public gallery",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to enable image";
      toast.error(message);
    } finally {
      setProcessingIds(prev => {
        const next = new Set(prev);
        next.delete(imageId);
        return next;
      });
    }
  };

  const handleApproveImage = async (imageId: Id<"images">) => {
    setProcessingIds(prev => new Set(prev).add(imageId));
    try {
      await approveImage({ imageId });
      toast.success("Image approved", {
        description: "Image is now live in the public gallery",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to approve image";
      toast.error(message);
    } finally {
      setProcessingIds(prev => {
        const next = new Set(prev);
        next.delete(imageId);
        return next;
      });
    }
  };

  const handleRejectImage = async () => {
    if (!rejectTarget) return;
    const imageId = rejectTarget._id;
    setProcessingIds(prev => new Set(prev).add(imageId));
    try {
      await rejectImage({
        imageId,
        reason: rejectReason.trim() || "Does not meet quality standards"
      });
      toast.success("Image rejected", {
        description: "User will be notified of the rejection",
      });
      setRejectTarget(null);
      setRejectReason("");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to reject image";
      toast.error(message);
    } finally {
      setProcessingIds(prev => {
        const next = new Set(prev);
        next.delete(imageId);
        return next;
      });
    }
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
        const descriptionParts =
          segments.length > 0 ? `Removed ${segments.join(" and ")}.` : undefined;
        toast.success("Image deleted", {
          description: result.actedAsAdmin
            ? `${descriptionParts ?? "Deletion completed."} The user can no longer access this photo.`
            : (descriptionParts ?? "Deletion completed."),
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

  const handleNormalizeFeatured = async () => {
    setIsNormalizing(true);
    try {
      const updated = await normalizeFeatured();
      toast.success("Featured images normalized", {
        description: `Updated ${updated} image${updated !== 1 ? "s" : ""} to be visible in public gallery.`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to normalize images";
      toast.error(message);
    } finally {
      setIsNormalizing(false);
    }
  };

  // Filter out images being processed for optimistic UI updates
  const currentImages = activeTab === "pending" ? pendingImages : featuredImages;
  const filteredImages = currentImages?.page.filter(img => !processingIds.has(img._id));

  return (
    <div className="space-y-8 p-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-semibold">Featured Images Moderation</h2>
        <p className="text-muted-foreground">Review and moderate public gallery images</p>
        <div className="flex justify-center pt-4">
          <Button
            onClick={handleNormalizeFeatured}
            disabled={isNormalizing}
            variant="outline"
            size="sm"
            className="gap-2"
          >
            {isNormalizing ? "Normalizing..." : "Fix Public Gallery Visibility"}
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "pending" | "approved")}>
        <TabsList className="grid w-full max-w-md mx-auto grid-cols-2">
          <TabsTrigger value="pending">
            Pending Review {pendingImages?.page.length ? `(${pendingImages.page.length}${pendingImages.isDone ? "" : "+"})` : ""}
          </TabsTrigger>
          <TabsTrigger value="approved">Approved</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredImages?.map((image) => (
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
                  {activeTab === "pending" ? (
                    <>
                      <Button
                        onClick={() => handleApproveImage(image._id)}
                        variant="outline"
                        size="sm"
                        className="text-green-600 border-green-600 hover:bg-green-50 flex-1"
                        disabled={processingIds.has(image._id)}
                      >
                        {processingIds.has(image._id) ? "Approving..." : "Approve"}
                      </Button>
                      <Button
                        onClick={() => setRejectTarget(image)}
                        variant="outline"
                        size="sm"
                        className="text-red-600 border-red-600 hover:bg-red-50 flex-1"
                        disabled={processingIds.has(image._id)}
                      >
                        Reject
                      </Button>
                    </>
                  ) : (
                    <>
                      {image.isDisabledByAdmin ? (
                        <Button
                          onClick={() => handleEnableImage(image._id)}
                          variant="outline"
                          size="sm"
                          className="text-green-600 border-green-600 hover:bg-green-50"
                          disabled={processingIds.has(image._id)}
                        >
                          {processingIds.has(image._id) ? "Enabling..." : "Re-enable"}
                        </Button>
                      ) : (
                        <Button
                          onClick={() => setSelectedImageId(image._id)}
                          variant="outline"
                          size="sm"
                          className="text-red-600 border-red-600 hover:bg-red-50"
                          disabled={processingIds.has(image._id)}
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
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
          </div>

          {currentImages?.continueCursor && !currentImages.isDone && (
            <div className="flex justify-center mt-6">
              <Button
                onClick={() =>
                  activeTab === "pending"
                    ? setPendingPaginationOpts({ numItems: 20, cursor: currentImages.continueCursor })
                    : setApprovedPaginationOpts({ numItems: 20, cursor: currentImages.continueCursor })
                }
                variant="ghost"
              >
                Load More Images
              </Button>
            </div>
          )}
        </TabsContent>
      </Tabs>

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
              This will permanently remove this user&apos;s image and all generated versions. This
              action cannot be undone.
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
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                    Delete Image
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {rejectTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full space-y-4">
            <h3 className="text-lg font-semibold text-red-600">Reject Feature Request</h3>
            <p className="text-sm text-muted-foreground">
              This will notify the user that their feature request was declined. Please provide a
              reason:
            </p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g., Does not meet quality standards, inappropriate content, etc."
              className="w-full p-3 border rounded-md min-h-[100px]"
              rows={4}
            />
            <div className="flex gap-2 justify-end">
              <Button
                onClick={() => {
                  setRejectTarget(null);
                  setRejectReason("");
                }}
                variant="ghost"
              >
                Cancel
              </Button>
              <Button
                onClick={handleRejectImage}
                variant="destructive"
                disabled={rejectTarget ? processingIds.has(rejectTarget._id) : false}
              >
                {rejectTarget && processingIds.has(rejectTarget._id) ? "Rejecting..." : "Reject Request"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
