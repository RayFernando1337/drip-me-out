# File Upload Technical Specification (Option A)

**Document Name:** File Upload Feature – Implementation Plan  
**Date:** 2025-09-08  
**Version:** 0.2  
**Status:** Planning

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
- Page UI: [app/page.tsx](file:///Users/ray/workspace/drip-me-out/app/page.tsx#L239-L333)  
- Storage & queries: [convex/images.ts](file:///Users/ray/workspace/drip-me-out/convex/images.ts#L1-L128)  
- Generation + scheduling: [convex/generate.ts](file:///Users/ray/workspace/drip-me-out/convex/generate.ts#L79-L105, file:///Users/ray/workspace/drip-me-out/convex/generate.ts#L107-L264)

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

- Helper module (suggested): [lib/imagePrep.ts](file:///Users/ray/workspace/drip-me-out/lib/imagePrep.ts)

```ts
// lib/imagePrep.ts
// Note: used only from client components ("use client" or dynamic import from app/page.tsx)

export type Prepared = { file: File; wasTranscoded: boolean; wasCompressed: boolean };

const ALLOWED_INPUTS = ["image/jpeg", "image/png", "image/heic", "image/heif"]; // allow HEIC

export async function prepareImageForUpload(file: File): Promise<Prepared> {
  if (!ALLOWED_INPUTS.includes(file.type)) {
    throw new Error("Unsupported file type");
  }

  let working: Blob | File = file;
  let wasTranscoded = false;
  let wasCompressed = false;

  // 1) Transcode HEIC/HEIF → JPEG when needed
  if (file.type === "image/heic" || file.type === "image/heif") {
    const heic2any = (await import("heic2any")).default as any;
    const jpegBlob = (await heic2any({ blob: file, toType: "image/jpeg", quality: 0.85 })) as Blob;
    working = new File([jpegBlob], file.name.replace(/\.(heic|heif)$/i, ".jpg"), { type: "image/jpeg" });
    wasTranscoded = true;
  }

  // 2) Compress/downscale to ≤ 5 MB and max 2048px
  const imageCompression = (await import("browser-image-compression")).default as any;
  const compressed = await imageCompression(working as File, {
    maxSizeMB: 5,
    maxWidthOrHeight: 2048,
    fileType: "image/jpeg",
    useWebWorker: true,
    initialQuality: 0.85,
  });

  if (compressed.size < (working as File).size) wasCompressed = true;

  return { file: compressed, wasTranscoded, wasCompressed };
}
```

- Usage in [app/page.tsx](file:///Users/ray/workspace/drip-me-out/app/page.tsx#L270-L303):

```ts
// inside handleSendImage before generateUploadUrl
import("@/lib/imagePrep").then(async ({ prepareImageForUpload }) => {
  const { file: prepared } = await prepareImageForUpload(selectedImage);
  const uploadUrl = await generateUploadUrl();
  const result = await fetch(uploadUrl, {
    method: "POST",
    headers: { "Content-Type": prepared.type },
    body: prepared,
  });
  // then scheduleImageGeneration as today
});
```

### Server-side validation (Convex)
- Where: in `scheduleImageGeneration` mutation in [convex/generate.ts](file:///Users/ray/workspace/drip-me-out/convex/generate.ts#L79-L105) before inserting the original image.  
- How: use `ctx.db.system.get(storageId)` to fetch `_storage` document and validate `size` and `contentType`.  
- Policy: allow `image/jpeg`, `image/png`, `image/heic`, `image/heif`; max size = 5 MB.  
- Behavior: if invalid, `throw new Error("VALIDATION: <reason>")` so the client can surface a precise toast; do not insert or schedule.

Pseudo-diff (shape only):

```ts
// convex/generate.ts
export const scheduleImageGeneration = mutation({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    const { storageId } = args;

    // 0) Validate file metadata
    const meta = await ctx.db.system.get(storageId);
    if (!meta) throw new Error("VALIDATION: Missing storage metadata");

    const allowed = new Set(["image/jpeg", "image/png", "image/heic", "image/heif"]);
    if (!meta.contentType || !allowed.has(meta.contentType)) {
      throw new Error("VALIDATION: Unsupported content type");
    }
    if (meta.size > 5 * 1024 * 1024) {
      throw new Error("VALIDATION: File exceeds 5 MB limit");
    }

    // 1) Insert original image with pending status (existing code)
    const originalImageId = await ctx.db.insert("images", {
      body: storageId,
      createdAt: Date.now(),
      isGenerated: false,
      generationStatus: "pending",
    });

    // 2) Schedule generation (existing code)
    await ctx.scheduler.runAfter(0, internal.generate.generateImage, { storageId, originalImageId });
    return originalImageId;
  },
});
```

- Client surfacing (optional, small): in [app/page.tsx](file:///Users/ray/workspace/drip-me-out/app/page.tsx#L187-L237), if `error.message` starts with `"VALIDATION:"`, display that exact message in a toast and re-enable UI.

### UI & Accessibility
- Tabs: un-comment the Upload trigger; keep default tab on “Camera”.  
- Wrap Upload content with `<form onSubmit={handleSendImage}>` for Enter-to-submit.  
- File input: add `aria-label="Choose image file"` and helper region with `role="alert"` for validation messages.  
- Button: use `aria-busy={isUploading || isGenerating}` and disable while processing or invalid.

### Validation (client-side)
- Allowed: JPEG, PNG, HEIC/HEIF.  
- Max size: 5 MB.  
- If invalid: show helper text and toast; do not network.

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

## Security Considerations
- Auth remains required (UI gated).  
- Signed URLs are short-lived and single-use.  
- Server-side limits protect storage and compute.

## Rollout Plan
1. Branch `feat/upload-ui`.  
2. Implement Upload tab enablement + accessibility (small diff in [app/page.tsx](file:///Users/ray/workspace/drip-me-out/app/page.tsx#L263-L309)).  
3. Add [lib/imagePrep.ts](file:///Users/ray/workspace/drip-me-out/lib/imagePrep.ts) and wire to `handleSendImage`.  
4. Add server validation in `scheduleImageGeneration` (tiny diff in [convex/generate.ts](file:///Users/ray/workspace/drip-me-out/convex/generate.ts#L79-L105)).  
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
