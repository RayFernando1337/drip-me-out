# Admin Review Workflow - Stacked Diff Plan

## Overview
Breaking down the admin review feature into 7 incremental, independently reviewable changes using Graphite stacked diffs.

## Stack Structure

```
main
  ↓
1. feat/admin-review-schema
  ↓
2. feat/admin-review-queries
  ↓
3. feat/admin-review-mutations
  ↓
4. feat/admin-review-modify-feature-toggle
  ↓
5. feat/admin-review-frontend-imagemodal
  ↓
6. feat/admin-review-admin-dashboard
  ↓
7. feat/admin-review-migration
```

---

## Stack 1: Schema Foundation
**Branch:** `feat/admin-review-schema`  
**Description:** Add new database fields and indexes (non-breaking)

### Changes:
- `convex/schema.ts`
  - Add `featureRequestedAt: v.optional(v.number())`
  - Add `featureApprovedAt: v.optional(v.number())`
  - Add `featureApprovedBy: v.optional(v.string())`
  - Add `featureRejectedAt: v.optional(v.number())`
  - Add `featureRejectedBy: v.optional(v.string())`
  - Add `featureRejectionReason: v.optional(v.string())`
  - Add index: `by_featureRequestedAt`
  - Add index: `by_isFeatured_and_featureRequestedAt`

### Testing:
```bash
bunx convex dev
# Verify no errors, schema deploys successfully
```

### Commit message:
```
feat(schema): add admin review fields for featured images

- Add timestamp and metadata fields for feature approval workflow
- Add indexes for efficient pending queue queries
- All fields optional to maintain backward compatibility
```

---

## Stack 2: Query - Pending Queue
**Branch:** `feat/admin-review-queries`  
**Parent:** `feat/admin-review-schema`  
**Description:** Add query to fetch pending featured images

### Changes:
- `convex/admin.ts`
  - Add `getPendingFeaturedImages` query
  - Includes full validator with all image fields

### Code:
```typescript
export const getPendingFeaturedImages = query({
  args: { paginationOpts: paginationOptsValidator },
  returns: v.object({
    page: v.array(/* copy full validator from getAdminFeaturedImages */),
    isDone: v.boolean(),
    continueCursor: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, args) => {
    await assertAdmin(ctx);
    
    const result = await ctx.db
      .query("images")
      .withIndex("by_isFeatured_and_featureRequestedAt", q => 
        q.eq("isFeatured", true)
      )
      .filter(q => q.eq(q.field("featureApprovedAt"), undefined))
      .order("desc")
      .paginate(args.paginationOpts);

    const imagesWithUrls = await mapImagesToUrls(ctx, result.page);
    return {
      page: imagesWithUrls,
      isDone: result.isDone,
      continueCursor: result.continueCursor,
    };
  },
});
```

### Testing:
```bash
# Should return empty array (no pending images yet)
# Verify no TypeScript errors
```

### Commit message:
```
feat(admin): add query for pending featured images

- New getPendingFeaturedImages query for admin review queue
- Filters images where isFeatured=true but featureApprovedAt=undefined
- Uses new compound index for efficient pagination
```

---

## Stack 3: Mutations - Approve/Reject
**Branch:** `feat/admin-review-mutations`  
**Parent:** `feat/admin-review-queries`  
**Description:** Add admin mutations to approve or reject featured images

### Changes:
- `convex/admin.ts`
  - Add `approveFeaturedImage` mutation
  - Add `rejectFeaturedImage` mutation

### Code:
```typescript
export const approveFeaturedImage = mutation({
  args: { imageId: v.id("images") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await assertAdmin(ctx);
    const identity = await requireIdentity(ctx);
    
    const image = await ctx.db.get(args.imageId);
    if (!image) throw new Error("Image not found");
    if (!image.isFeatured) throw new Error("Image not marked for featuring");
    if (image.featureApprovedAt) throw new Error("Already approved");
    
    await ctx.db.patch(args.imageId, {
      featureApprovedAt: Date.now(),
      featureApprovedBy: identity.subject,
      featuredAt: Date.now(),
      featureRejectedAt: undefined,
      featureRejectedBy: undefined,
      featureRejectionReason: undefined,
    });
    return null;
  },
});

export const rejectFeaturedImage = mutation({
  args: { 
    imageId: v.id("images"),
    reason: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await assertAdmin(ctx);
    const identity = await requireIdentity(ctx);
    
    const image = await ctx.db.get(args.imageId);
    if (!image) throw new Error("Image not found");
    if (!image.isFeatured) throw new Error("Image not marked for featuring");
    
    await ctx.db.patch(args.imageId, {
      isFeatured: false,
      featureRejectedAt: Date.now(),
      featureRejectedBy: identity.subject,
      featureRejectionReason: args.reason.trim(),
      featureApprovedAt: undefined,
      featureApprovedBy: undefined,
      featureRequestedAt: undefined,
      featuredAt: undefined,
    });
    return null;
  },
});
```

### Testing:
```bash
# Manually test via Convex dashboard
# Verify error handling for invalid states
```

### Commit message:
```
feat(admin): add approve/reject mutations for featured images

- approveFeaturedImage: marks image as approved and sets live
- rejectFeaturedImage: removes feature flag and records reason
- Both require admin auth and validate image state
```

---

## Stack 4: Modify Feature Toggle (CRITICAL)
**Branch:** `feat/admin-review-modify-feature-toggle`  
**Parent:** `feat/admin-review-mutations`  
**Description:** Update user feature toggle to create pending state + filter public gallery

### Changes:
- `convex/images.ts`
  - Modify `updateFeaturedStatus` mutation (set featureRequestedAt, clear featureApprovedAt)
  - Modify `getPublicGallery` query (add filter for featureApprovedAt !== undefined)

### Code changes:

**updateFeaturedStatus:**
```typescript
// Replace the patch logic with:
if (args.isFeatured) {
  // User requests featuring - enters pending state
  await ctx.db.patch(args.imageId, {
    isFeatured: true,
    featureRequestedAt: Date.now(),
    featureApprovedAt: undefined,
    featuredAt: undefined,
    featureRejectedAt: undefined,
    featureRejectedBy: undefined,
    featureRejectionReason: undefined,
    isDisabledByAdmin: image.isDisabledByAdmin ?? false,
  });
} else {
  // User un-features - clear all
  await ctx.db.patch(args.imageId, {
    isFeatured: false,
    featureRequestedAt: undefined,
    featureApprovedAt: undefined,
    featureApprovedBy: undefined,
    featureRejectedAt: undefined,
    featureRejectedBy: undefined,
    featureRejectionReason: undefined,
    featuredAt: undefined,
  });
}
```

**getPublicGallery:**
```typescript
// Add filter after the compound index query:
const result = await ctx.db
  .query("images")
  .withIndex("by_isFeatured_and_isDisabledByAdmin_and_featuredAt", (q) =>
    q.eq("isFeatured", true).eq("isDisabledByAdmin", false)
  )
  .filter(q => q.neq(q.field("featureApprovedAt"), undefined))  // NEW
  .order("desc")
  .paginate(args.paginationOpts);
```

### Testing:
```bash
# Test: Toggle feature on → image should NOT appear in public gallery
# Test: Admin approve → image should appear in public gallery
# Test: Toggle feature off → all timestamps cleared
```

### Commit message:
```
feat(images): implement pending approval state for featured images

BREAKING BEHAVIOR CHANGE:
- When users enable "feature", images now enter pending state
- Public gallery now only shows admin-approved images
- Existing featured images without featureApprovedAt are hidden

This is intentional - next commit will include migration to backfill.
```

---

## Stack 5: Frontend - ImageModal
**Branch:** `feat/admin-review-frontend-imagemodal`  
**Parent:** `feat/admin-review-modify-feature-toggle`  
**Description:** Add UI feedback for pending/rejected states

### Changes:
- `components/ImageModal.tsx`
  - Add rejection reason display
  - Add pending approval indicator
  - Update type to include new fields

### Code additions:
```tsx
// Add to type definition
type ImageWithFeatured = ImageFromQuery & {
  isFeatured?: boolean;
  isDisabledByAdmin?: boolean;
  disabledByAdminReason?: string;
  featureRequestedAt?: number;
  featureApprovedAt?: number;
  featureRejectedAt?: number;
  featureRejectionReason?: string;
};

// Add after existing settings content, before the feature toggle:
{extended?.featureRejectedAt && extended?.featureRejectionReason && (
  <div className="text-xs text-destructive bg-destructive/10 p-2 rounded-md flex items-start gap-2">
    <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
    <div>
      <strong>Feature request declined:</strong>{" "}
      {extended.featureRejectionReason}
    </div>
  </div>
)}

{isFeatured && extended?.featureRequestedAt && !extended?.featureApprovedAt && (
  <div className="text-xs text-yellow-600 dark:text-yellow-400 flex items-center gap-1 bg-yellow-50 dark:bg-yellow-900/20 p-2 rounded-md">
    <Clock className="h-3 w-3" />
    <span>Pending admin approval - your image will appear in the public gallery once reviewed.</span>
  </div>
)}
```

### Testing:
```bash
bun run dev
# Test: Feature an image → should show "Pending admin approval"
# Test: After rejection → should show rejection reason
```

### Commit message:
```
feat(ui): add pending/rejected status indicators to image modal

- Show "Pending admin approval" message when feature requested
- Display rejection reason with alert icon when request declined
- Users get clear feedback on feature request status
```

---

## Stack 6: Frontend - Admin Dashboard
**Branch:** `feat/admin-review-admin-dashboard`  
**Parent:** `feat/admin-review-frontend-imagemodal`  
**Description:** Add pending queue tab and approve/reject actions

### Changes:
- `components/AdminModerationDashboard.tsx`
  - Add tab navigation (Pending | Approved)
  - Add approve/reject buttons
  - Add rejection reason modal

### Key additions:
```tsx
const [activeTab, setActiveTab] = useState<"pending" | "approved">("pending");
const pendingImages = useQuery(api.admin.getPendingFeaturedImages, { paginationOpts });
const approveImage = useMutation(api.admin.approveFeaturedImage);
const rejectImage = useMutation(api.admin.rejectFeaturedImage);

// Tabs UI
<Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "pending" | "approved")}>
  <TabsList>
    <TabsTrigger value="pending">
      Pending Review {pendingImages?.page.length ? `(${pendingImages.page.length})` : ""}
    </TabsTrigger>
    <TabsTrigger value="approved">Approved</TabsTrigger>
  </TabsList>
</Tabs>

// Action buttons for pending images
{activeTab === "pending" && (
  <div className="flex gap-2">
    <Button onClick={() => approveImage({ imageId: image._id })} size="sm">
      Approve
    </Button>
    <Button onClick={() => setRejectTarget(image)} variant="destructive" size="sm">
      Reject
    </Button>
  </div>
)}
```

### Testing:
```bash
# Navigate to /admin
# Verify pending tab shows un-approved featured images
# Test approve flow → image moves to approved tab
# Test reject flow → image disappears from both tabs
```

### Commit message:
```
feat(admin): add pending queue and approval workflow to dashboard

- New tabbed interface: Pending Review | Approved
- Approve button: one-click approval, image goes live
- Reject button: prompt for reason, removes feature flag
- Clear visual distinction between pending and live images
```

---

## Stack 7: Migration (Final)
**Branch:** `feat/admin-review-migration`  
**Parent:** `feat/admin-review-admin-dashboard`  
**Description:** Backfill existing featured images as auto-approved

### Changes:
- `convex/admin.ts`
  - Add `backfillFeaturedApprovals` mutation

### Code:
```typescript
export const backfillFeaturedApprovals = mutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    await assertAdmin(ctx);
    
    const featured = await ctx.db
      .query("images")
      .withIndex("by_isFeatured", q => q.eq("isFeatured", true))
      .filter(q => q.eq(q.field("featureApprovedAt"), undefined))
      .collect();
    
    for (const img of featured) {
      await ctx.db.patch(img._id, {
        featureApprovedAt: img.featuredAt ?? Date.now(),
        featureApprovedBy: "SYSTEM_MIGRATION",
        featureRequestedAt: img.featuredAt ?? img.createdAt,
      });
    }
    
    return featured.length;
  },
});
```

### Manual step:
```bash
# Run in Convex dashboard after deployment
await api.admin.backfillFeaturedApprovals()
```

### Testing:
```bash
# Before: Public gallery should be empty (or only have newly approved images)
# Run migration
# After: All previously featured images should reappear
```

### Commit message:
```
feat(admin): add migration to backfill featured image approvals

- Backfills featureApprovedAt for all existing featured images
- Sets approval metadata (by: SYSTEM_MIGRATION)
- Restores public gallery visibility for legacy featured images
- Run once after deployment via Convex dashboard
```

---

## Execution Commands

```bash
# Start from main
git checkout main
git pull origin main

# Create stack
gt create feat/admin-review-schema
# Make changes for stack 1
git add convex/schema.ts
git commit -m "feat(schema): add admin review fields for featured images"

gt create feat/admin-review-queries
# Make changes for stack 2
git add convex/admin.ts
git commit -m "feat(admin): add query for pending featured images"

gt create feat/admin-review-mutations
# Make changes for stack 3
git add convex/admin.ts
git commit -m "feat(admin): add approve/reject mutations for featured images"

gt create feat/admin-review-modify-feature-toggle
# Make changes for stack 4
git add convex/images.ts
git commit -m "feat(images): implement pending approval state for featured images"

gt create feat/admin-review-frontend-imagemodal
# Make changes for stack 5
git add components/ImageModal.tsx
git commit -m "feat(ui): add pending/rejected status indicators to image modal"

gt create feat/admin-review-admin-dashboard
# Make changes for stack 6
git add components/AdminModerationDashboard.tsx
git commit -m "feat(admin): add pending queue and approval workflow to dashboard"

gt create feat/admin-review-migration
# Make changes for stack 7
git add convex/admin.ts
git commit -m "feat(admin): add migration to backfill featured image approvals"

# Submit entire stack as PRs
gt stack submit
```

---

## Review Order

1. **Schema** - Safe, non-breaking foundation
2. **Query** - Read-only, can't break anything
3. **Mutations** - Admin-only, isolated actions
4. **Feature Toggle** - Critical change, but isolated to backend
5. **ImageModal** - Frontend UX improvement
6. **Admin Dashboard** - New admin functionality
7. **Migration** - Cleanup, restores existing data

Each PR can be reviewed independently, and the stack can be landed incrementally.

---

## Benefits of This Approach

✅ **Small PRs** - Each change is focused and reviewable in < 10 minutes  
✅ **Safe progression** - No breaking changes until stack 4, which is intentional  
✅ **Independent testing** - Each layer can be tested in isolation  
✅ **Easy rollback** - Can merge 1-3 without breaking existing functionality  
✅ **Clear intent** - Each commit has single responsibility  
✅ **Parallel review** - Different reviewers can review different stacks simultaneously
