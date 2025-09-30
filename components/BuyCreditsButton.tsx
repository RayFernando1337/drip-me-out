"use client";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { useState, useMemo, useEffect } from "react";
import { toast } from "sonner";
import { useUser } from "@clerk/nextjs";
import type { Id } from "@/convex/_generated/dataModel";

function polarBase() {
  // Default to sandbox in dev; override with NEXT_PUBLIC_POLAR_ENV="production"
  const env = (process.env.NEXT_PUBLIC_POLAR_ENV || "sandbox").toLowerCase();
  return env === "production" ? "https://api.polar.sh/v1" : "https://sandbox-api.polar.sh/v1";
}

export default function BuyCreditsButton() {
  const initiateCheckout = useMutation(api.payments.initiateCheckout);
  const [loading, setLoading] = useState(false);
  const [checkoutSessionId, setCheckoutSessionId] = useState<Id<"checkoutSessions"> | null>(null);
  const { user } = useUser();

  // Poll checkout session status
  const checkoutSession = useQuery(
    api.payments.getCheckoutSession,
    checkoutSessionId ? { sessionId: checkoutSessionId } : "skip"
  );

  const customerEmail = user?.primaryEmailAddress?.emailAddress || undefined;
  const customerName = useMemo(() => {
    return user?.fullName || [user?.firstName, user?.lastName].filter(Boolean).join(" ") || undefined;
  }, [user?.fullName, user?.firstName, user?.lastName]);

  // Handle checkout session completion
  useEffect(() => {
    if (!checkoutSession) return;

    if (checkoutSession.status === "completed" && checkoutSession.clientSecret && checkoutSession.url) {
      // Try client confirmation via Polar Customer API; fallback to hosted URL
      const confirmCheckout = async () => {
        try {
          const res = await fetch(
            `${polarBase()}/checkouts/client/${encodeURIComponent(checkoutSession.clientSecret!)}/confirm`,
            {
              method: "POST",
              headers: { Accept: "application/json" },
            }
          );

          if (!res.ok) {
            // Some environments may block client confirm due to CORS; fallback to redirect
            window.location.href = checkoutSession.url!;
            return;
          }

          toast.success("Payment confirmed", { description: "Credits will appear shortly." });
          setCheckoutSessionId(null);
        } catch (err) {
          console.error("Checkout confirmation error:", err);
          // Fallback to redirect on any error
          window.location.href = checkoutSession.url!;
        } finally {
          setLoading(false);
        }
      };

      confirmCheckout();
    } else if (checkoutSession.status === "failed") {
      toast.error("Checkout failed", { description: checkoutSession.error || "Unknown error" });
      setLoading(false);
      setCheckoutSessionId(null);
    }
  }, [checkoutSession]);

  const onClick = async () => {
    try {
      setLoading(true);
      const successUrl = typeof window !== "undefined" ? window.location.origin : undefined;
      const embedOrigin = typeof window !== "undefined" ? window.location.origin : undefined;

      // Initiate checkout - this is fast and returns immediately
      const sessionId = await initiateCheckout({
        successUrl,
        embedOrigin,
        customerEmail,
        customerName,
      });

      // Set session ID to start polling
      setCheckoutSessionId(sessionId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err || "");
      toast.error("Checkout failed", { description: msg });
      setLoading(false);
    }
  };

  return (
    <Button onClick={onClick} disabled={loading} size="sm" variant="outline">
      {loading ? "Processing…" : "Buy Credits ($5)"}
    </Button>
  );
}
