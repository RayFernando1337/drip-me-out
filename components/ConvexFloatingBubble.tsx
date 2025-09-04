"use client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Database } from "lucide-react";
import { useState } from "react";
import ConvexShowcase from "./ConvexShowcase";

export default function ConvexFloatingBubble() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="fixed bottom-6 right-6 z-50 group">
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <Button
            size="lg"
            className="h-14 w-14 rounded-full bg-primary hover:bg-primary/90 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110 animate-pulse"
            onClick={() => setIsOpen(true)}
          >
            <Database className="w-6 h-6 text-white" />
          </Button>
        </DialogTrigger>

        {/* Tooltip */}
        <div className="absolute bottom-full right-0 mb-3 px-3 py-2 bg-black/90 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-200 whitespace-nowrap pointer-events-none shadow-lg border border-white/10">
          <div className="flex items-center gap-1">
            <Database className="w-3 h-3" />
            <span>Explore Convex Features</span>
          </div>
          <div className="absolute top-full right-4 w-0 h-0 border-l-[6px] border-r-[6px] border-t-[6px] border-transparent border-t-black/90"></div>
        </div>

        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden p-4 bg-background border-border/50">
          <DialogHeader className="mb-4 pb-2 border-b border-border/50">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-primary rounded-md">
                <Database className="w-4 h-4 text-primary-foreground" />
              </div>
              <div>
                <DialogTitle className="text-lg font-medium">Convex Features</DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">Real-time backend showcase</DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="overflow-y-auto max-h-[calc(80vh-80px)]">
            <ConvexShowcase />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
