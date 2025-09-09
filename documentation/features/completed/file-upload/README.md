# File Upload Feature

**Status:** ✅ Complete  
**Completed:** January 27, 2025

## Overview

Comprehensive file upload functionality with client-side image optimization, server-side validation, and graceful error handling. Enables users to upload existing photos in addition to webcam capture.

## Features Implemented

- **Client-Side Compression**: HEIC/HEIF → JPEG transcoding with browser-image-compression
- **Server-Side Validation**: Size and type enforcement via Convex storage metadata
- **Error Recovery**: Upload retry with fresh signed URLs
- **Progress Feedback**: Preparing/uploading states with visual indicators
- **Failed Image Management**: Dedicated UI for retry actions
- **Auto-Retry Logic**: Single automatic retry for transient failures
- **Performance Optimization**: Background processing with status tracking

## Technical Details

- **Supported Formats**: JPEG, PNG, HEIC/HEIF with automatic transcoding
- **Size Limits**: 5MB max with automatic compression to fit
- **Processing Pipeline**: Client prep → Upload → Server validation → AI generation
- **Storage**: Convex Storage with signed upload URLs
- **Status Tracking**: Pending → Processing → Completed/Failed with real-time updates

## Architecture

- **Frontend**: `lib/imagePrep.ts` handles compression/transcoding
- **Backend**: `convex/images.ts` validation and scheduling
- **Generation**: `convex/generate.ts` AI processing pipeline
- **UI**: Integrated into main upload flow with error handling

## Files

- [Technical Specification](./file-upload-spec.md)
- [Implementation Progress](./file-upload-progress.md)
