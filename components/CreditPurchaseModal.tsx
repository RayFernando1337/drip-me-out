"use client";
import { api } from "@/convex/_generated/api";
import { useAction, useQuery } from "convex/react";
import { useUser } from "@clerk/nextjs";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { Sparkles, CreditCard, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

interface CreditPurchaseModalProps {
  children: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

function polarBase() {
  // Default to sandbox in dev; override with NEXT_PUBLIC_POLAR_ENV="production"
  const env = (process.env.NEXT_PUBLIC_POLAR_ENV || "sandbox").toLowerCase();
  return env === "production" ? "https://api.polar.sh/v1" : "https://sandbox-api.polar.sh/v1";
}

export default function CreditPurchaseModal({ children, open, onOpenChange }: CreditPurchaseModalProps) {
  const createCheckout = useAction(api.payments.createCheckoutSession);
  const userCreditsData = useQuery(api.users.getCurrentUserCredits);
  const [loading, setLoading] = useState(false);
  const { user } = useUser();

  // Memoize user credits to prevent unnecessary re-renders
  const userCredits = useMemo(() => userCreditsData, [userCreditsData]);

  const customerEmail = user?.primaryEmailAddress?.emailAddress || undefined;
  const customerName = useMemo(() => {
    return user?.fullName || [user?.firstName, user?.lastName].filter(Boolean).join(" ") || undefined;
  }, [user?.fullName, user?.firstName, user?.lastName]);

  const handlePurchase = async () => {
    try {
      setLoading(true);
      const successUrl = typeof window !== "undefined" ? window.location.origin : undefined;
      const embedOrigin = typeof window !== "undefined" ? window.location.origin : undefined;
      const { clientSecret, url } = await createCheckout({ 
        successUrl, 
        embedOrigin, 
        customerEmail, 
        customerName 
      });

      // Try client confirmation via Polar Customer API; fallback to hosted URL
      const res = await fetch(`${polarBase()}/checkouts/client/${encodeURIComponent(clientSecret)}/confirm`, {
        method: "POST",
        headers: { Accept: "application/json" },
      });

      if (!res.ok) {
        // Some environments may block client confirm due to CORS; fallback to redirect
        window.location.href = url;
        return;
      }

      // Success feedback with credit expectation
      toast.success("Payment confirmed!", { 
        description: "420 credits will appear in your account within moments. The page credit balance will update automatically.",
        duration: 6000,
      });
      onOpenChange?.(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err || "");
      toast.error("Checkout failed", { description: msg });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Buy Credits
          </DialogTitle>
          <DialogDescription>
            Credits are used to generate AI transformations of your images
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Current Balance */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Current Balance</p>
                  <p className="text-2xl font-bold">
                    {userCredits === undefined ? (
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading...
                      </div>
                    ) : (
                      <>
                        {userCredits.credits} credit{userCredits.credits !== 1 ? 's' : ''}
                      </>
                    )}
                  </p>
                </div>
                {userCredits?.hasFreeTrial && (
                  <Badge variant="secondary" className="text-xs">
                    Free Trial
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Credit Pack Details */}
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <h3 className="font-semibold">Credit Pack</h3>
                    <p className="text-sm text-muted-foreground">
                      420 credits for unlimited transformations
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold">$5</p>
                    <p className="text-xs text-muted-foreground">~$0.012 per credit</p>
                  </div>
                </div>
                
                <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>Each transformation</span>
                    <span>1 credit</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span>Average cost per image</span>
                    <span>~$0.012</span>
                  </div>
                  <div className="flex items-center justify-between text-sm font-medium pt-2 border-t border-border">
                    <span>420 transformations</span>
                    <span>$5.00</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Purchase Button */}
          <Button 
            onClick={handlePurchase} 
            disabled={loading} 
            className="w-full" 
            size="lg"
          >
            <CreditCard className="h-4 w-4 mr-2" />
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              "Purchase Credits - $5"
            )}
          </Button>

          <p className="text-xs text-muted-foreground text-center">
            Secure payment powered by Polar. Credits never expire.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
