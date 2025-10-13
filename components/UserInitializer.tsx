"use client";

import { api } from "@/convex/_generated/api";
import { useMutation } from "convex/react";
import { useEffect, useRef } from "react";

/**
 * UserInitializer ensures that a user record is created in the database
 * when they first sign in. This grants them their initial free trial credits.
 * 
 * This component should be mounted once for authenticated users.
 */
export function UserInitializer() {
  const ensureUser = useMutation(api.users.ensureUser);
  const hasInitialized = useRef(false);

  useEffect(() => {
    // Only run once per session
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    // Call ensureUser to create the user record if it doesn't exist
    // This will grant initial credits (freeTrialCredits) on first sign-in
    ensureUser()
      .then(() => {
        console.log("[UserInitializer] User record ensured");
      })
      .catch((error) => {
        console.error("[UserInitializer] Failed to ensure user:", error);
        // Don't throw - let the app continue working
        // The user will be created when they try to upload an image
      });
  }, [ensureUser]);

  // This component doesn't render anything
  return null;
}
