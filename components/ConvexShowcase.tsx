"use client";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { api } from "@/convex/_generated/api";
import { useQuery } from "convex/react";
import {
    Activity,
    Clock,
    Database,
    FileText,
    Server,
    Shield,
    Sparkles,
    Zap
} from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";

interface ConvexFeature {
    icon: React.ReactNode;
    title: string;
    description: string;
    codeExample: string;
    liveDemo: string;
    category: "database" | "storage" | "realtime" | "actions" | "scheduling";
    color: string;
}

export default function ConvexShowcase() {
    const [animatedFeatures, setAnimatedFeatures] = useState<number[]>([]);
    const imagesData = useQuery(api.images.getImages);
    const images = useMemo(() => imagesData || [], [imagesData]);

    const features: ConvexFeature[] = useMemo(() => [
        {
            icon: <Database className="w-8 h-8" />,
            title: "Convex Database",
            description: "Real-time database with automatic sync and offline support",
            codeExample: `// Schema definition with indexes
export default defineSchema({
  images: defineTable({
    body: v.string(),
    createdAt: v.number(),
    isGenerated: v.optional(v.boolean()),
    generationStatus: v.optional(v.string()),
  })
  .index("by_created_at", ["createdAt"])
  .index("by_generation_status", ["generationStatus"])
})`,
            liveDemo: `${images.length} images stored`,
            category: "database",
            color: "from-blue-500 to-cyan-500"
        },
        {
            icon: <Activity className="w-8 h-8" />,
            title: "Queries",
            description: "Live-updating data with automatic reactivity",
            codeExample: `// React hook for real-time data
const images = useQuery(api.images.getImages) || [];

// Data updates automatically in UI
{images.map(image => (
  <img key={image._id} src={image.url} />
))}`,
            liveDemo: `${images.filter(img => img.generationStatus === 'processing').length} processing`,
            category: "realtime",
            color: "from-teal-500 to-green-500"
        },
        {
            icon: <Zap className="w-8 h-8" />,
            title: "Mutations",
            description: "Server-side functions that modify data",
            codeExample: `// Schedule image generation mutation
export const scheduleImageGeneration = mutation({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    const imageId = await ctx.db.insert("images", {
      body: args.storageId,
      createdAt: Date.now(),
      generationStatus: "pending",
    });
    return imageId;
  },
});`,
            liveDemo: "Create & update data",
            category: "database",
            color: "from-orange-500 to-red-500"
        },
        {
            icon: <FileText className="w-8 h-8" />,
            title: "File Storage",
            description: "Secure file uploads with automatic URL generation",
            codeExample: `// Generate upload URLs
const uploadUrl = await generateUploadUrl();

// Upload file to Convex storage
const result = await fetch(uploadUrl, {
  method: "POST",
  headers: { "Content-Type": file.type },
  body: file,
});`,
            liveDemo: "File upload & storage",
            category: "storage",
            color: "from-green-500 to-emerald-500"
        },
        {
            icon: <Clock className="w-8 h-8" />,
            title: "Scheduler",
            description: "Background job scheduling for async tasks",
            codeExample: `// Schedule image generation
await ctx.scheduler.runAfter(0,
  internal.generate.generateImage, {
    storageId,
    originalImageId,
  }
);`,
            liveDemo: "Background processing",
            category: "scheduling",
            color: "from-purple-500 to-pink-500"
        },
        {
            icon: <Server className="w-8 h-8" />,
            title: "Internal Actions",
            description: "Server-only functions for sensitive operations",
            codeExample: `export const generateImage = internalAction({
  args: {
    storageId: v.id("_storage"),
    originalImageId: v.id("images"),
  },
  handler: async (ctx, args) => {
    // AI image generation logic here
    const ai = new GoogleGenAI({ apiKey });
    // ... generation code
  },
});`,
            liveDemo: "AI processing",
            category: "actions",
            color: "from-indigo-500 to-purple-500"
        },
        {
            icon: <Shield className="w-8 h-8" />,
            title: "Type Safety",
            description: "End-to-end TypeScript with generated types",
            codeExample: `// Generated types from schema
import { api } from "@/convex/_generated/api";

// Fully typed API calls
const uploadUrl = await generateUploadUrl();
const images = useQuery(api.images.getImages);`,
            liveDemo: "Type-safe development",
            category: "database",
            color: "from-rose-500 to-pink-500"
        }
    ], [images]);

    // Animate features on load
    useEffect(() => {
        const timer = setTimeout(() => {
            features.forEach((_, index) => {
                setTimeout(() => {
                    setAnimatedFeatures(prev => [...prev, index]);
                }, index * 150);
            });
        }, 500);
        return () => clearTimeout(timer);
    }, [features]);



    const getCategoryColor = (category: string) => {
        switch (category) {
            case "database": return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300";
            case "storage": return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
            case "realtime": return "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-300";
            case "actions": return "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300";
            case "scheduling": return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300";
            default: return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300";
        }
    };

    return (
        <div className="w-full space-y-4">
            {/* Live Stats */}
            <div className="flex items-center justify-center gap-3">
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-muted/50 border rounded-md">
                    <Activity className="w-3.5 h-3.5 text-green-500" />
                    <span className="text-xs font-medium">{images.length}</span>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-muted/50 border rounded-md">
                    <Clock className="w-3.5 h-3.5 text-orange-500" />
                    <span className="text-xs font-medium">
                        {images.filter(img => img.generationStatus === 'processing').length}
                    </span>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-muted/50 border rounded-md">
                    <Sparkles className="w-3.5 h-3.5 text-purple-500" />
                    <span className="text-xs font-medium">
                        {images.filter(img => img.generationStatus === 'completed').length}
                    </span>
                </div>
            </div>

            {/* Feature Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {features.map((feature, index) => (
                    <Card
                        key={index}
                        className={`p-4 group relative overflow-hidden transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 border-muted ${
                            animatedFeatures.includes(index)
                                ? 'opacity-100 translate-y-0'
                                : 'opacity-0 translate-y-4'
                        }`}
                    >
                        <div className="flex items-start gap-3">
                            <div className="p-1.5 rounded-md bg-muted text-muted-foreground flex-shrink-0">
                                {feature.icon}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                    <h3 className="text-sm font-medium truncate">{feature.title}</h3>
                                    <Badge
                                        variant="secondary"
                                        className={`text-xs px-1.5 py-0.5 ${getCategoryColor(feature.category)}`}
                                    >
                                        {feature.category}
                                    </Badge>
                                </div>
                                <p className="text-xs text-muted-foreground leading-tight mb-2 line-clamp-2">
                                    {feature.description}
                                </p>
                                <div className="flex items-center gap-1.5">
                                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                                    <span className="text-xs text-green-600 dark:text-green-400">
                                        {feature.liveDemo}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </Card>
                ))}
            </div>


        </div>
    );
}
