"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { logger } from "@/lib/logger";

export function PageTracker() {
 const pathname = usePathname();
 const prevPath = useRef<string | null>(null);

 useEffect(() => {
 if (pathname && pathname !== prevPath.current) {
 prevPath.current = pathname;
 logger?.pageView(pathname);
 }
 }, [pathname]);

 return null;
}