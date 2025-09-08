#!/bin/bash

# Deploy script with backward-compatible schema
# The schema now supports both old and new field names

set -e

echo "🚀 Starting deployment with backward-compatible schema..."

# Check if CONVEX_URL is set
if [ -z "$CONVEX_URL" ]; then
    echo "❌ Error: CONVEX_URL environment variable is not set"
    echo "Please set it to your Convex deployment URL"
    exit 1
fi

echo "🚀 Deploying to Convex..."
npx convex deploy

if [ $? -eq 0 ]; then
    echo "✅ Deployment completed successfully"
    echo "📝 Note: The schema now supports both 'body' and 'storageId' fields"
    echo "📝 New images will use 'storageId', old images will continue to work with 'body'"
else
    echo "❌ Deployment failed"
    exit 1
fi

echo "🎉 All done! Your app is now deployed with the updated schema."