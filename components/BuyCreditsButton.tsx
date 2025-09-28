"use client";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import { useAction } from "convex/react";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { useUser } from "@clerk/nextjs";

function polarBase() {
  // Default to sandbox in dev; override with NEXT_PUBLIC_POLAR_ENV="production"
  const env = (process.env.NEXT_PUBLIC_POLAR_ENV || "sandbox").toLowerCase();
  return env === "production" ? "https://api.polar.sh/v1" : "https://sandbox-api.polar.sh/v1";
}

export default function BuyCreditsButton() {
  const createCheckout = useAction(api.payments.createCheckoutSession);
  const [loading, setLoading] = useState(false);
  const { user } = useUser();
  const customerEmail = user?.primaryEmailAddress?.emailAddress || undefined;
  const customerName = useMemo(() => {
    return user?.fullName || [user?.firstName, user?.lastName].filter(Boolean).join(" ") || undefined;
  }, [user?.fullName, user?.firstName, user?.lastName]);

  const onClick = async () => {
    try {
      setLoading(true);
      const successUrl = typeof window !== "undefined" ? window.location.origin : undefined;
      const embedOrigin = typeof window !== "undefined" ? window.location.origin : undefined;
      const { clientSecret, url } = await createCheckout({ successUrl, embedOrigin, customerEmail, customerName });

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

      toast.success("Payment confirmed", { description: "Credits will appear shortly." });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err || "");
      toast.error("Checkout failed", { description: msg });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button onClick={onClick} disabled={loading} size="sm" variant="outline">
      {loading ? "Processing…" : "Buy Credits ($5)"}
    </Button>
  );
}
