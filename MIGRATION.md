# Schema Migration Guide

## Overview

This migration updates the `images` table schema to support both the old `body` field (string) and the new `storageId` field (proper Convex storage ID type). This provides backward compatibility while improving type safety and following Convex best practices.

## Migration Approach

### Backward-Compatible Schema

The schema now supports both field names:

```typescript
// Migration schema (supports both)
storageId: v.optional(v.id("_storage")) // New field
body: v.optional(v.string()) // Legacy field
```

### Code Handles Both Fields

The application code automatically handles both field names:

```typescript
// In images.ts and generate.ts
const storageId = image.storageId || (image as any).body;
```

## Deployment Steps

### 1. Deploy the Updated Schema

```bash
# Set your Convex URL
export CONVEX_URL="https://your-deployment.convex.cloud"

# Deploy with backward-compatible schema
npm run deploy
```

### 2. Verify Deployment

- ✅ Old images with `body` field continue to work
- ✅ New images use `storageId` field
- ✅ No data loss or breaking changes
- ✅ Build succeeds

## Benefits

1. **Zero Downtime** - No migration required
2. **Backward Compatible** - Old data continues to work
3. **Forward Compatible** - New data uses proper types
4. **No Data Loss** - All existing images preserved
5. **Gradual Migration** - Can migrate data over time if needed

## Rollback Plan

If issues occur:

1. The schema supports both fields during migration
2. Code handles both old and new field names
3. No data is lost during the process
4. Can revert schema changes if needed

## Files Modified

- `convex/schema.ts` - Updated schema with migration support
- `convex/migrations.ts` - Migration function
- `convex/images.ts` - Updated to handle both field names
- `convex/generate.ts` - Updated to handle both field names
- `scripts/migrate-images.js` - Migration script
- `package.json` - Added migrate script

## Testing

The migration has been designed to be safe:

- ✅ No data loss
- ✅ Backward compatible during migration
- ✅ Handles missing fields gracefully
- ✅ Logs all operations
- ✅ Can be run multiple times safely