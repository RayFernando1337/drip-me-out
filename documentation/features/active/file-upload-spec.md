# File Upload Technical Specification (Option A)

**Document Name:** File Upload Feature – Implementation Plan  
**Date:** 2025-09-08  
**Version:** 0.3  
**Status:** Active development

## Executive Summary
Enable signed-in users to upload an existing image file in addition to webcam capture. Use client-side compression (Option A: browser-image-compression + heic2any) to keep uploads ≤ 5 MB and standardize on JPEG when needed. Reuse the Convex storage + Gemini 2.5 Flash pipeline so uploaded images generate the same decorated outputs that appear in the real-time gallery. Add server-side validation in Convex to enforce size/type limits. Keep diffs minimal and agent-friendly.

## Problem Statement
Currently, users must enable the webcam to capture a photo. Users request the ability to upload existing photos from their device for processing. We need to add an Upload path that behaves identically to the webcam path and gracefully handles large iPhone images.

## Goals
- Add an Upload tab with a file chooser wired to the existing pipeline.  
- Client-side compress/transcode to ensure JPEG and ≤ 5 MB when needed.  
- Server-side enforce size/type to reject invalid uploads defensively.  
- Maintain consistent UX: toasts, loading states, background generation indicator, and gallery updates.  
- Keep diffs small; reuse Convex mutations and UI patterns.

## Non-Goals
- Heavy in-browser codecs (e.g., @squoosh/lib) for v1.  
- Drag-and-drop and thumbnail preview (possible follow-up).  
- Metadata preservation (EXIF) beyond defaults.

## User Stories
- As a user, I can switch to an Upload tab, choose an image ≤ 5 MB (JPEG/PNG/HEIC), and start generation.  
- As a user, if my file is too large or unsupported, I see a clear error and cannot submit.  
- As a user, I see consistent toasts and statuses during upload and generation, and my outputs appear in the gallery.

## Architecture Overview
End-to-end flow (with client compression and server validation):

```mermaid
flowchart LR
  U[User] -- selects file --> UI[Upload UI in app/page.tsx]
  UI -- if HEIC/non-JPEG & large --> H[heic2any (dynamic import)]
  UI -- compress/transcode --> C[browser-image-compression]
  UI -- useMutation: generateUploadUrl --> MU1[convex/images.generateUploadUrl]
  UI -- POST file to signed URL --> S[(Convex Storage)]
  UI -- useMutation: scheduleImageGeneration --> MU2[convex/generate.scheduleImageGeneration]
  MU2 -- validate size/type via system table --> VAL[db.system.get(_storage)]
  MU2 -- runAfter --> A[internal.generate.generateImage]
  A -- getUrl(storageId) --> S
  A -- GoogleGenAI --> G[Gemini 2.5 Flash]
  A -- store(generated) --> S
  A -- saveGeneratedImage --> DB[(images table)]
  A -- updateImageStatus: completed --> DB
  UI -- useQuery: images.getImages --> DB
  UI --> Gallery[ImagePreview]
```

Key integration points:
- Page UI: [app/page.tsx](file:///Users/ray/workspace/drip-me-out/app/page.tsx#L283-L324)  
- Storage & queries: [convex/images.ts](file:///Users/ray/workspace/drip-me-out/convex/images.ts#L1-L62)  
- Generation + scheduling: [convex/generate.ts](file:///Users/ray/workspace/drip-me-out/convex/generate.ts#L82-L120, file:///Users/ray/workspace/drip-me-out/convex/generate.ts#L122-L279)

## Detailed Design

### Client-side compression/transcoding (Option A)
- Libraries
  - Primary: browser-image-compression (JPEG/PNG/WebP/BMP; workers; simple API)  
    - https://github.com/Donaldcwl/browser-image-compression
  - HEIC support: heic2any (convert HEIC/HEIF → JPEG) via dynamic import on demand  
    - https://github.com/alexcorvi/heic2any

- Policy
  - Allowed inputs: JPEG, PNG, HEIC/HEIF.  
  - Target output: JPEG, max dimension 2048px, quality ~0.85, size ≤ 5 MB.  
  - Flow:
    - If file.type is HEIC/HEIF (or a non-JPEG that’s large), transcode to JPEG via heic2any first.  
    - Then run browser-image-compression to downscale to max 2048px and quality ~0.85, with `maxSizeMB: 5`.  
    - Upload the resulting File/Blob.

- Helper module: [lib/imagePrep.ts](file:///Users/ray/workspace/drip-me-out/lib/imagePrep.ts#L1-L58)

```ts
// inside handleSendImage before generateUploadUrl
const { prepareImageForUpload } = await import("@/lib/imagePrep");
const { file: prepared } = await prepareImageForUpload(selectedImage);
const uploadUrl = await generateUploadUrl();
await fetch(uploadUrl, { method: "POST", headers: { "Content-Type": prepared.type }, body: prepared });
```

### Server-side validation (Convex)
- Where: in `scheduleImageGeneration` mutation in [convex/generate.ts](file:///Users/ray/workspace/drip-me-out/convex/generate.ts#L89-L102) before inserting the original image.  
- How: use `ctx.db.system.get(storageId)` to fetch `_storage` document and validate `size` and `contentType`.  
- Policy: allow `image/jpeg`, `image/png`, `image/heic`, `image/heif`; max size = 5 MB.  
- Behavior: if invalid, `throw new Error("VALIDATION: <reason>")` so the client can surface a precise toast; do not insert or schedule.

## Acceptance Criteria
- Users can select files via Upload tab and start generation when valid.  
- Client ensures output ≤ 5 MB (downscaled to ≤ 2048px) and JPEG.  
- Server rejects invalid uploads (>5 MB or unsupported type) with clear validation messages.  
- Errors (quota, network, validation) surface via toasts; UI re-enables appropriately.  
- Generated outputs appear in the gallery; pagination and status indicators unchanged.  
- Lighthouse a11y ≥ 95.

## Testing & Verification
- Client
  - HEIC (iPhone) > 5 MB → converted + compressed to JPEG ≤ 5 MB; uploads; generates.  
  - JPEG/PNG 1–20 MB → downscaled to ≤ 2048px + compressed to ≤ 5 MB.  
  - Unsupported type → immediate client error.  
  - Offline / 5xx → toast and recovery.
- Server (Convex)
  - Enforced limits via `db.system.get`—rejects violations with `VALIDATION:` errors.  
  - Convex logs show clear validation denials.

## Rollout Plan
1. Branch `feat/upload-ui`.  
2. Implement Upload tab enablement + accessibility (small diff in [app/page.tsx](file:///Users/ray/workspace/drip-me-out/app/page.tsx#L283-L324)).  
3. Add [lib/imagePrep.ts](file:///Users/ray/workspace/drip-me-out/lib/imagePrep.ts#L1-L58) and wire to `handleSendImage`.  
4. Add server validation in `scheduleImageGeneration` (tiny diff in [convex/generate.ts](file:///Users/ray/workspace/drip-me-out/convex/generate.ts#L89-L102)).  
5. `bun run build` and keep `bunx convex dev` open; fix reported issues.  
6. Manual QA (Chrome, Safari iOS).  
7. Merge → monitor Convex logs for 24h.

## Risks & Mitigations
- Client CPU usage on large images: workers reduce UI blocking; show progress if desired.  
- HEIC decode variance across browsers: gated by dynamic import; fallback error messaging if conversion fails.  
- CSP restrictions: ensure worker-src and blob: allowed if CSP enforced.

## Open Questions
- Should we lower max dimension to 1536px for even smaller files on mobile networks?  
- Should we expose a visible progress bar for compression?
