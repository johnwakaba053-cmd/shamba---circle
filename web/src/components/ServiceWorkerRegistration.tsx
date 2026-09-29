"use client";

import { useEffect } from "react";

// Registers public/sw.js (see that file for why it caches nothing but an
// offline page). Browsers only allow service workers in a secure context
// -- HTTPS or localhost -- so on a plain http:// LAN address this is a
// silent no-op and the app simply runs as a normal website.
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!("serviceWorker" in navigator) || !window.isSecureContext) return;

    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .catch(() => {
        // Registration failing only means no offline page / install
        // support; the app itself keeps working.
      });
  }, []);

  return null;
}
