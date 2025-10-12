"use client";

import { useEffect } from "react";

// Declare UnicornStudio on window
declare global {
  interface Window {
    UnicornStudio?: {
      isInitialized: boolean;
      init: () => void;
    };
  }
}

export function AuraBackground() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    if (!window.UnicornStudio) {
      window.UnicornStudio = { isInitialized: false, init: () => {} };
      const script = document.createElement("script");
      script.src =
        "https://cdn.jsdelivr.net/gh/hiunicornstudio/unicornstudio.js@v1.4.29/dist/unicornStudio.umd.js";
      script.onload = function () {
        if (window.UnicornStudio && !window.UnicornStudio.isInitialized) {
          window.UnicornStudio.init();
          window.UnicornStudio.isInitialized = true;
        }
      };
      (document.head || document.body).appendChild(script);
    }
  }, []);

  return (
    <div className="fixed inset-0 -z-10 w-full h-full pointer-events-none">
      <div data-us-project="inzENTvhzS9plyop7Z6g" className="absolute w-full h-full left-0 top-0" />
    </div>
  );
}
