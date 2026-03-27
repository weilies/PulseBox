"use client";

import { useEffect } from "react";
import { logger } from "@/lib/logger";

export default function DashboardError({
 error,
 reset,
}: {
 error: Error & { digest?: string };
 reset: () => void;
}) {
 useEffect(() => {
 logger?.error("component_error", error.message, {
 digest: error.digest,
 stack: error.stack,
 area: "dashboard",
 });
 }, [error]);

 return (
 <div className="flex flex-1 items-center justify-center p-6">
 <div className="mx-auto max-w-md text-center">
 <h2 className="text-lg font-semibold text-destructive">
 Dashboard Error
 </h2>
 <p className="mt-2 text-sm text-muted-foreground">
 {error.message || "Something went wrong loading this page."}
 </p>
 <button
 onClick={reset}
 className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
 >
 Try Again
 </button>
 </div>
 </div>
 );
}