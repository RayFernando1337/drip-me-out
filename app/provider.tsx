"use client";

import { ReactNode, useEffect } from "react";
import { ConvexReactClient, useMutation } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { useAuth } from "@clerk/nextjs";
import { api } from "@/convex/_generated/api";

if (!process.env.NEXT_PUBLIC_CONVEX_URL) {
  throw new Error("Missing NEXT_PUBLIC_CONVEX_URL in your .env file");
}

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL);

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  return (
    <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
      <EnsureUserOnAuth />
      {children}
    </ConvexProviderWithClerk>
  );
}

function EnsureUserOnAuth() {
  const { isLoaded, isSignedIn } = useAuth();
  const ensureUser = useMutation(api.users.ensureUser);

  useEffect(() => {
    if (!isLoaded) return;
    if (isSignedIn) {
      // Idempotent: creates user with initial credits if missing
      ensureUser().catch(() => {
        // Swallow errors to avoid breaking app shell on sign-in edge cases
      });
    }
  }, [isLoaded, isSignedIn, ensureUser]);

  return null;
}
