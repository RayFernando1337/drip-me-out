"use client";
import { api } from "@/convex/_generated/api";
import { useQuery } from "convex/react";
import { useUser } from "@clerk/nextjs";
import { Sparkles, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function CreditBalance() {
  const { isSignedIn } = useUser();
  const credits = useQuery(api.users.getCurrentUserCredits);

  // Don't show for unauthenticated users
  if (!isSignedIn) {
    return null;
  }

  // Loading state
  if (credits === undefined) {
    return (
      <Badge variant="secondary" className="flex items-center gap-1.5 px-3 py-1.5">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        <span className="text-sm font-medium">Loading...</span>
      </Badge>
    );
  }

  // Determine styling based on credit count
  const isLowCredits = credits.credits <= 5 && credits.credits > 0;
  const isZeroCredits = credits.credits === 0;
  
  const badgeVariant = isZeroCredits ? "destructive" : isLowCredits ? "outline" : "secondary";
  
  return (
    <Badge 
      variant={badgeVariant}
      className="flex items-center gap-1.5 px-3 py-1.5 cursor-default"
      title={`You have ${credits.credits} generation credits${credits.hasFreeTrial ? ' (free trial active)' : ''}`}
    >
      <Sparkles className="h-3.5 w-3.5" />
      <span className="text-sm font-medium">
        {credits.credits} credit{credits.credits !== 1 ? 's' : ''}
      </span>
    </Badge>
  );
}
