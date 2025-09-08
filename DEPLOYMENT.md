# Deployment Guide

## Quick Deploy

To deploy with automatic migration:

```bash
# Set your Convex URL
export CONVEX_URL="https://your-deployment.convex.cloud"

# Deploy with migration
npm run deploy
```

## Manual Steps

If you prefer to run the steps manually:

### 1. Run Data Migration

```bash
export CONVEX_URL="https://your-deployment.convex.cloud"
npm run migrate
```

### 2. Deploy to Convex

```bash
npx convex deploy
```

## What Happens

1. **Data Migration**: Migrates existing images from `body` field to `storageId` field
2. **Schema Deployment**: Deploys the updated schema with proper types
3. **Build**: Builds the Next.js application
4. **Verification**: Ensures everything works correctly

## Troubleshooting

### Migration Fails
- Check that `CONVEX_URL` is set correctly
- Ensure you have write access to the Convex deployment
- Check Convex logs for detailed error messages

### Build Fails
- The migration must complete successfully before the build
- Check that all images have been migrated
- Verify the schema is correct

### Deployment Fails
- Ensure all previous steps completed successfully
- Check Convex deployment logs
- Verify environment variables are set

## Environment Variables

Required:
- `CONVEX_URL`: Your Convex deployment URL
- `NEXT_PUBLIC_CONVEX_URL`: Same as CONVEX_URL (for client-side)

Optional:
- `GEMINI_API_KEY`: For AI image generation
- `CLERK_PUBLISHABLE_KEY`: For authentication