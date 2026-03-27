"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { logger } from "@/lib/logger";

export function ErrorListener() {
 useEffect(() => {
 function handleError(event: ErrorEvent) {
 const message = event.message || "Unknown error";
 logger?.error("unhandled_error", message, {
 filename: event.filename,
 lineno: event.lineno,
 colno: event.colno,
 stack: event.error?.stack,
 });
 toast.error("Something went wrong", {
 description: message,
 });
 }

 function handleRejection(event: PromiseRejectionEvent) {
 const reason = event.reason;
 const message =
 reason instanceof Error ? reason.message : String(reason);
 logger?.error("unhandled_error", `Unhandled promise rejection: ${message}`, {
 stack: reason instanceof Error ? reason.stack : undefined,
 });
 toast.error("Something went wrong", {
 description: message,
 });
 }

 window.addEventListener("error", handleError);
 window.addEventListener("unhandledrejection", handleRejection);

 return () => {
 window.removeEventListener("error", handleError);
 window.removeEventListener("unhandledrejection", handleRejection);
 };
 }, []);

 return null;
}