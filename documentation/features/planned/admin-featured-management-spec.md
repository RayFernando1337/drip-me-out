# Admin Featured Management Enhancements

**Document Name:** Admin Featured Image Management System  
**Date:** December 2024  
**Version:** 1.0  
**Status:** Planning

## Executive Summary

Enhance the admin moderation dashboard with advanced featured image management capabilities including bulk operations, scheduling, analytics, and automated curation suggestions.

## Current State

**Existing Features:**
- `/components/AdminModerationDashboard.tsx`
- View featured images paginated
- Enable/disable individual images
- Delete images
- Add disable reasons

**Limitations:**
- No bulk operations
- Manual curation only
- No scheduling or rotation
- No performance analytics
- No quality suggestions

## Proposed Enhancements

### 1. Bulk Operations
- Select multiple images (checkboxes)
- Bulk enable/disable
- Bulk delete
- Bulk category assignment
- Bulk showcase tagging

### 2. Featured Image Scheduling
- Schedule feature start/end dates
- Automatic rotation (e.g., rotate hero images weekly)
- Holiday/seasonal campaigns
- Preview scheduled changes

### 3. Curation Analytics
- View count per featured image
- Click-through rate to sign-in
- Engagement metrics (hover time, shares)
- A/B test different featured sets

### 4. AI-Powered Suggestions
- Auto-suggest high-quality images for featuring
- Analyze image metrics (likes, shares, transformations)
- Diversity checker (ensure variety in featured gallery)
- Quality score based on transformation clarity

### 5. Organization & Filtering
- Filter by status (active, disabled, scheduled)
- Search by user, date, category
- Sort by performance metrics
- Tag system for internal organization

## Architecture Overview

### Enhanced Admin Dashboard Component

```tsx
// /components/AdminModerationDashboard.tsx (enhanced)

interface AdminImage extends FeaturedImage {
  // New fields
  analytics?: {
    views: number
    clicks: number
    ctr: number
  }
  scheduledStart?: number
  scheduledEnd?: number
  qualityScore?: number
  aiSuggestion?: boolean
}

export default function AdminModerationDashboard() {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "disabled">("all")
  const [sortBy, setSortBy] = useState<"date" | "views" | "ctr">("date")
  
  // Bulk operations
  const handleBulkAction = async (action: string) => {
    // Implementation
  }
  
  return (
    <div>
      {/* Filters & Sorting */}
      <AdminFilters />
      
      {/* Bulk Actions Bar */}
      {selectedIds.size > 0 && <BulkActionsBar />}
      
      {/* Image Grid with Selection */}
      <ImageGrid />
      
      {/* AI Suggestions Sidebar */}
      <AISuggestions />
    </div>
  )
}
```

## Implementation Phases

### Phase 1: Bulk Operations (Priority: HIGH)

**Features:**
- Multi-select checkboxes on image cards
- Bulk action bar appears when items selected
- Actions: Enable All, Disable All, Delete All, Add to Category

**UI Components:**
```tsx
// /components/admin/BulkActionsBar.tsx
<div className="sticky bottom-0 bg-background border-t p-4">
  <div className="flex items-center justify-between">
    <span>{selectedCount} selected</span>
    <div className="flex gap-2">
      <Button onClick={handleBulkEnable}>Enable All</Button>
      <Button onClick={handleBulkDisable}>Disable All</Button>
      <Button variant="destructive" onClick={handleBulkDelete}>
        Delete All
      </Button>
    </div>
  </div>
</div>
```

**Convex Mutations:**
```typescript
// convex/admin.ts

export const bulkUpdateFeaturedStatus = mutation({
  args: {
    imageIds: v.array(v.id("images")),
    isFeatured: v.boolean(),
  },
  handler: async (ctx, args) => {
    // Verify admin
    // Update all images in transaction
  }
})

export const bulkDeleteImages = mutation({
  args: {
    imageIds: v.array(v.id("images")),
  },
  handler: async (ctx, args) => {
    // Verify admin
    // Delete all images and their storage
  }
})
```

### Phase 2: Scheduling System (Priority: MEDIUM)

**Schema Changes:**
```typescript
// convex/schema.ts
defineTable({
  // ... existing fields
  featuredSchedule: v.optional(v.object({
    startAt: v.number(),      // Unix timestamp
    endAt: v.optional(v.number()),  // Optional end date
    recurring: v.optional(v.string()), // "weekly", "monthly"
  })),
})
```

**Cron Job:**
```typescript
// convex/crons.ts

export default {
  updateFeaturedImages: {
    schedule: "0 0 * * *", // Daily at midnight
    handler: async (ctx) => {
      const now = Date.now()
      
      // Enable images that should start
      const toEnable = await ctx.db
        .query("images")
        .filter(q => 
          q.and(
            q.eq(q.field("isFeatured"), false),
            q.lte(q.field("featuredSchedule.startAt"), now)
          )
        )
        .collect()
      
      for (const image of toEnable) {
        await ctx.db.patch(image._id, { isFeatured: true })
      }
      
      // Disable images that should end
      const toDisable = await ctx.db
        .query("images")
        .filter(q =>
          q.and(
            q.eq(q.field("isFeatured"), true),
            q.lte(q.field("featuredSchedule.endAt"), now)
          )
        )
        .collect()
      
      for (const image of toDisable) {
        await ctx.db.patch(image._id, { isFeatured: false })
      }
    }
  }
}
```

**Schedule Modal:**
```tsx
// /components/admin/ScheduleFeaturedModal.tsx

<Dialog>
  <DialogContent>
    <h3>Schedule Featured Image</h3>
    
    <Label>Start Date</Label>
    <DatePicker value={startDate} onChange={setStartDate} />
    
    <Label>End Date (Optional)</Label>
    <DatePicker value={endDate} onChange={setEndDate} />
    
    <Label>Recurring</Label>
    <Select>
      <option value="">One-time</option>
      <option value="weekly">Weekly</option>
      <option value="monthly">Monthly</option>
    </Select>
    
    <Button onClick={handleSchedule}>Schedule</Button>
  </DialogContent>
</Dialog>
```

### Phase 3: Analytics Dashboard (Priority: MEDIUM)

**New Table: Image Analytics**
```typescript
// convex/schema.ts
defineTable({
  imageId: v.id("images"),
  eventType: v.string(), // "view", "click", "share"
  timestamp: v.number(),
  source: v.string(),    // "hero", "gallery", "showcase"
  sessionId: v.optional(v.string()),
})
.index("by_imageId", ["imageId"])
.index("by_eventType_and_timestamp", ["eventType", "timestamp"])
```

**Analytics Query:**
```typescript
// convex/analytics.ts

export const getImageAnalytics = query({
  args: { imageId: v.id("images") },
  returns: v.object({
    views: v.number(),
    clicks: v.number(),
    ctr: v.number(),
    shares: v.number(),
    viewsBySource: v.object({
      hero: v.number(),
      gallery: v.number(),
      showcase: v.number(),
    }),
  }),
  handler: async (ctx, args) => {
    // Aggregate analytics for image
  }
})

export const getTopPerformingImages = query({
  args: { limit: v.number() },
  handler: async (ctx, args) => {
    // Return images sorted by CTR or engagement
  }
})
```

**Analytics UI:**
```tsx
// /components/admin/ImageAnalytics.tsx

<Card>
  <CardHeader>
    <h3>Performance Metrics</h3>
  </CardHeader>
  <CardContent>
    <div className="grid grid-cols-3 gap-4">
      <Metric label="Views" value={analytics.views} />
      <Metric label="Clicks" value={analytics.clicks} />
      <Metric label="CTR" value={`${analytics.ctr.toFixed(2)}%`} />
    </div>
    
    <h4>Views by Source</h4>
    <BarChart data={analytics.viewsBySource} />
  </CardContent>
</Card>
```

### Phase 4: AI-Powered Suggestions (Priority: LOW)

**Suggestion Algorithm:**
```typescript
// convex/admin.ts

export const getAISuggestions = query({
  handler: async (ctx) => {
    // Criteria for suggestions:
    // 1. High engagement (if available)
    // 2. Good transformation quality (clear difference original->generated)
    // 3. Not currently featured
    // 4. Created within last 30 days (fresh content)
    // 5. Not disabled by admin
    // 6. User has good standing (no violations)
    
    const recentImages = await ctx.db
      .query("images")
      .withIndex("by_createdAt")
      .order("desc")
      .filter(q =>
        q.and(
          q.eq(q.field("isFeatured"), false),
          q.eq(q.field("isGenerated"), true),
          q.eq(q.field("isDisabledByAdmin"), false)
        )
      )
      .take(100)
    
    // Score each image
    const scored = recentImages.map(image => ({
      ...image,
      score: calculateQualityScore(image)
    }))
    
    // Return top 10
    return scored.sort((a, b) => b.score - a.score).slice(0, 10)
  }
})

function calculateQualityScore(image: any): number {
  let score = 0
  
  // Recency bonus
  const ageInDays = (Date.now() - image.createdAt) / (1000 * 60 * 60 * 24)
  if (ageInDays < 7) score += 10
  else if (ageInDays < 14) score += 5
  
  // Success bonus (generated successfully)
  if (image.generationStatus === "completed") score += 20
  
  // Could add more criteria:
  // - User engagement (likes, shares)
  // - Image dimensions (prefer certain sizes)
  // - Color vibrancy
  // - Transformation clarity
  
  return score
}
```

**Suggestions UI:**
```tsx
// /components/admin/AISuggestions.tsx

<aside className="w-80 border-l p-4">
  <h3>AI Suggestions</h3>
  <p className="text-sm text-muted-foreground">
    Images recommended for featuring
  </p>
  
  {suggestions?.map((suggestion) => (
    <Card key={suggestion._id}>
      <Image src={suggestion.url} />
      <div>
        <Badge>Score: {suggestion.score}</Badge>
        <Button onClick={() => handleFeature(suggestion._id)}>
          Feature This
        </Button>
      </div>
    </Card>
  ))}
</aside>
```

## Testing & Verification

### Functional Tests
- [ ] Bulk selection works across paginated results
- [ ] Bulk actions execute atomically (all or nothing)
- [ ] Scheduling cron runs correctly
- [ ] Analytics track events accurately
- [ ] AI suggestions refreshed periodically

### Performance Tests
- [ ] Bulk operations on 100+ images complete in <3s
- [ ] Analytics queries cached appropriately
- [ ] Dashboard loads in <1s

### Security Tests
- [ ] Only admins can access dashboard
- [ ] Bulk operations require re-authentication
- [ ] Rate limiting on mutations
- [ ] Audit log for all admin actions

## Timeline Estimate

- Phase 1 (Bulk): 2 days
- Phase 2 (Scheduling): 3 days
- Phase 3 (Analytics): 4 days
- Phase 4 (AI Suggestions): 2 days

**Total: 11 days** (2.5 weeks)

## Success Metrics

- Admin time to curate gallery reduced by 50%
- Featured image quality score increased
- More diverse representation in featured gallery
- Zero scheduling errors or missed rotations
