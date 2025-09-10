"use client";
import AdminModerationDashboard from "@/components/AdminModerationDashboard";
import { Authenticated } from "convex/react";

export default function AdminPage() {
  // Backend enforces admin via Convex; client wrapper just requires auth
  return (
    <Authenticated>
      <div className="min-h-screen">
        <header className="sticky top-0 z-40 flex items-center justify-between w-full px-6 py-4 border-b border-border/20 bg-background/95 backdrop-blur-sm">
          <h1 className="text-2xl font-bold">Admin</h1>
        </header>
        <main>
          <AdminModerationDashboard />
        </main>
      </div>
    </Authenticated>
  );
}

