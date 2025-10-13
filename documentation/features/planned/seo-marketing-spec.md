# SEO & Marketing Enhancement Specification

**Document Name:** SEO Optimization & Marketing Infrastructure  
**Date:** December 2024  
**Version:** 1.0  
**Status:** Planning

## Executive Summary

Implement comprehensive SEO optimization and marketing infrastructure to improve search engine rankings, social media sharing, and organic user acquisition for Anime Leak.

## Current State

**What Exists:**

- Basic metadata in layout.tsx
- OpenGraph tags on share pages
- Twitter card support
- Vercel Analytics installed

**What's Missing:**

- Dynamic OG images for shares
- Structured data (JSON-LD)
- XML sitemap
- robots.txt configuration
- Content strategy for SEO
- Social media automation
- Referral tracking

## Target Goals

- Rank on first page for "AI anime transformation"
- 1000+ organic visitors/month within 3 months
- 20% social share rate on transformations
- Featured in AI tool directories

## Implementation Phases

### Phase 1: Dynamic Open Graph Images (Priority: HIGH)

#### Problem

Current share links show generic OG images or the transformation image directly. We need branded, attractive social cards.

#### Solution: Vercel OG Image Generation

**Create:** `/app/api/og/route.tsx`

```tsx
import { ImageResponse } from "@vercel/og";

export const runtime = "edge";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const imageUrl = searchParams.get("image");
  const title = searchParams.get("title") || "Check Out My Anime Transformation!";

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        }}
      >
        {/* Main transformation image */}
        {imageUrl && (
          <img
            src={imageUrl}
            style={{
              width: "60%",
              height: "100%",
              objectFit: "cover",
            }}
          />
        )}

        {/* Branded overlay */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            padding: "40px",
            width: "40%",
          }}
        >
          <h1 style={{ fontSize: 48, color: "white", marginBottom: 20 }}>{title}</h1>
          <p style={{ fontSize: 24, color: "rgba(255,255,255,0.9)" }}>
            Transform objects into anime art with AI
          </p>
          <div style={{ marginTop: 40, display: "flex", alignItems: "center" }}>
            {/* Logo/Brand */}
            <div style={{ fontSize: 32, fontWeight: "bold", color: "white" }}>🎨 Anime Leak</div>
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
```

**Usage in Share Page:**

```tsx
// /app/share/[imageId]/page.tsx
export async function generateMetadata({ params }) {
  const { imageId } = await params;
  const image = await fetchQuery(api.images.getImageById, { imageId });

  if (!image)
    return {
      /* ... */
    };

  // Generate OG image URL
  const ogImageUrl =
    `${process.env.NEXT_PUBLIC_URL}/api/og?` +
    `image=${encodeURIComponent(image.url)}` +
    `&title=${encodeURIComponent("Check Out My Anime Transformation!")}`;

  return {
    title: "Check Out My Anime Transformation!",
    openGraph: {
      images: [{ url: ogImageUrl }],
    },
    twitter: {
      images: [ogImageUrl],
      card: "summary_large_image",
    },
  };
}
```

### Phase 2: Structured Data (JSON-LD) (Priority: HIGH)

#### Implement Schema.org Markup

**For Landing Page:** WebSite + Organization

```tsx
// /app/page.tsx or layout.tsx
<script
  type="application/ld+json"
  dangerouslySetInnerHTML={{
    __html: JSON.stringify({
      "@context": "https://schema.org",
      "@type": "WebSite",
      "name": "Anime Leak",
      "description": "Transform objects into anime illustrations with AI",
      "url": "https://animeleak.com",
      "potentialAction": {
        "@type": "SearchAction",
        "target": "https://animeleak.com/search?q={search_term_string}",
        "query-input": "required name=search_term_string"
      }
    })
  }}
/>

<script
  type="application/ld+json"
  dangerouslySetInnerHTML={{
    __html: JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Organization",
      "name": "Anime Leak",
      "url": "https://animeleak.com",
      "logo": "https://animeleak.com/logo.png",
      "sameAs": [
        "https://twitter.com/RayFernando1337",
        "https://instagram.com/RayFernando1337"
      ]
    })
  }}
/>
```

**For Transformations:** ImageObject + CreativeWork

```tsx
// /app/share/[imageId]/page.tsx
<script
  type="application/ld+json"
  dangerouslySetInnerHTML={{
    __html: JSON.stringify({
      "@context": "https://schema.org",
      "@type": "ImageObject",
      contentUrl: image.url,
      name: "Anime Transformation",
      description: "AI-generated anime illustration",
      creator: {
        "@type": "Organization",
        name: "Anime Leak",
      },
      datePublished: new Date(image.createdAt).toISOString(),
    }),
  }}
/>
```

### Phase 3: XML Sitemap (Priority: MEDIUM)

**Create:** `/app/sitemap.ts`

```typescript
import { MetadataRoute } from "next";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = "https://animeleak.com";

  // Fetch all public share pages
  const publicImages = await fetchQuery(api.images.getPublicGallery, {
    paginationOpts: { numItems: 1000, cursor: null },
  });

  const imageUrls =
    publicImages?.page.map((img) => ({
      url: `${baseUrl}/share/${img._id}`,
      lastModified: new Date(img.featuredAt || img.createdAt),
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })) || [];

  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${baseUrl}/gallery`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.8,
    },
    ...imageUrls,
  ];
}
```

**Create:** `/app/robots.ts`

```typescript
import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/api/", "/_next/"],
    },
    sitemap: "https://animeleak.com/sitemap.xml",
  };
}
```

### Phase 4: SEO Content Strategy (Priority: MEDIUM)

#### Landing Page Optimization

**Add SEO-friendly sections:**

1. **H1 Heading** - Already in hero: "Transform Objects Into Anime Art"

2. **FAQ Section** - Answer common questions

```tsx
// /components/FAQ.tsx
<section className="py-16">
  <h2>Frequently Asked Questions</h2>

  <Accordion>
    <AccordionItem>
      <AccordionTrigger>What is Anime Leak?</AccordionTrigger>
      <AccordionContent>
        Anime Leak is an AI-powered tool that transforms everyday objects into beautiful anime-style
        illustrations where anime leaks into reality. Simply upload a photo and watch as our AI
        creates magical artwork.
      </AccordionContent>
    </AccordionItem>

    <AccordionItem>
      <AccordionTrigger>How does the AI transformation work?</AccordionTrigger>
      <AccordionContent>
        We use Google's Gemini 2.5 Flash AI model to analyze your image and recreate it in a
        whimsical anime aesthetic. The transformation typically takes 10-30 seconds.
      </AccordionContent>
    </AccordionItem>

    {/* More FAQs */}
  </Accordion>
</section>
```

3. **Footer with Internal Links**

```tsx
// /components/Footer.tsx
<footer>
  <div className="grid grid-cols-4 gap-8">
    <div>
      <h3>Product</h3>
      <Link href="/gallery">Gallery</Link>
      <Link href="/pricing">Pricing</Link>
      <Link href="/examples">Examples</Link>
    </div>

    <div>
      <h3>Resources</h3>
      <Link href="/blog">Blog</Link>
      <Link href="/tutorials">Tutorials</Link>
      <Link href="/faq">FAQ</Link>
    </div>

    <div>
      <h3>Company</h3>
      <Link href="/about">About</Link>
      <Link href="/privacy">Privacy</Link>
      <Link href="/terms">Terms</Link>
    </div>

    <div>
      <h3>Social</h3>
      <Link href="https://twitter.com/RayFernando1337">Twitter</Link>
      <Link href="https://instagram.com/RayFernando1337">Instagram</Link>
    </div>
  </div>
</footer>
```

#### Blog for Content Marketing

**Create:** `/app/blog/` directory

**Topics:**

- "How to Transform Objects into Anime Art with AI"
- "Studio Ghibli Art Style: A Complete Guide"
- "10 Creative Ideas for AI Anime Transformations"
- "Behind the Scenes: How Our AI Model Works"

**SEO Benefits:**

- Long-tail keyword targeting
- Backlink opportunities
- Establishes authority
- Fresh content signals

### Phase 5: Social Media Automation (Priority: LOW)

#### Auto-Tweet Featured Transformations

**Convex Cron Job:**

```typescript
// convex/crons.ts
export default {
  tweetFeaturedImage: {
    schedule: "0 */4 * * *", // Every 4 hours
    handler: async (ctx) => {
      // Get random featured image
      const featured = await ctx.db
        .query("images")
        .withIndex("by_isFeatured_and_isDisabledByAdmin_and_featuredAt")
        .filter((q) => q.eq(q.field("isFeatured"), true))
        .order("desc")
        .take(10);

      const randomImage = featured[Math.floor(Math.random() * featured.length)];

      // Post to Twitter via API
      const tweetText = `✨ Amazing anime transformation!\n\nCreate your own at animeleak.com\n\nBy @RayFernando1337 #AI #AnimeArt`;

      await fetch("https://api.twitter.com/2/tweets", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.TWITTER_BEARER_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: tweetText,
          media: {
            media_ids: [
              /* upload image first */
            ],
          },
        }),
      });
    },
  },
};
```

### Phase 6: Analytics & Tracking (Priority: MEDIUM)

#### UTM Parameter Tracking

**Create:** `/lib/analytics.ts`

```typescript
export function trackReferral(source: string, medium: string, campaign: string) {
  // Store in localStorage and Convex
  localStorage.setItem("referral", JSON.stringify({ source, medium, campaign }))

  // Track in Convex for attribution
  const trackMutation = /* ... */
}

// Usage: automatically detect UTM params
useEffect(() => {
  const params = new URLSearchParams(window.location.search)
  const source = params.get("utm_source")
  const medium = params.get("utm_medium")
  const campaign = params.get("utm_campaign")

  if (source) {
    trackReferral(source, medium, campaign)
  }
}, [])
```

#### Attribution Tracking

**Schema:**

```typescript
defineTable({
  userId: v.string(),
  referralSource: v.optional(v.string()),
  referralMedium: v.optional(v.string()),
  referralCampaign: v.optional(v.string()),
  landingPage: v.string(),
  timestamp: v.number(),
});
```

**Report Dashboard:**

- Conversions by source
- Top performing campaigns
- Referral traffic breakdown

### Phase 7: Directory Submissions (Priority: LOW)

**Submit to:**

- Product Hunt
- AI tool directories (Futurepedia, AI Tools, etc.)
- Indie Hackers
- Reddit communities (r/SideProject, r/AITools)
- Twitter/X AI communities

**Preparation:**

- Professional screenshots
- Demo video (30-60s)
- Elevator pitch
- Press kit

## Testing & Verification

### SEO Audit Tools

- Google Search Console
- Bing Webmaster Tools
- Ahrefs/SEMrush
- Screaming Frog SEO Spider

### Acceptance Criteria

- [ ] All pages have unique meta descriptions
- [ ] OG images render correctly on Twitter/Facebook
- [ ] Sitemap accessible and valid
- [ ] Structured data validates (Google Rich Results Test)
- [ ] No broken internal links
- [ ] Mobile-friendly test passes
- [ ] Page speed insights: 90+ score

## Timeline Estimate

- Phase 1 (OG Images): 1 day
- Phase 2 (Structured Data): 1 day
- Phase 3 (Sitemap): 0.5 day
- Phase 4 (Content): 3 days
- Phase 5 (Social): 1 day
- Phase 6 (Analytics): 1 day
- Phase 7 (Directories): Ongoing

**Total: 7.5 days** (1.5 weeks)

## Success Metrics

- Organic search traffic: 0 → 1000+/month
- Domain authority: Unknown → 30+
- Backlinks: Unknown → 50+
- Social shares per transformation: <5% → 20%
- Featured in top 10 AI tool lists
