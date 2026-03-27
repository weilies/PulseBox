"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, X } from "lucide-react";

const CATEGORIES = [
  { value: "", label: "All categories" },
  { value: "audit", label: "Audit" },
  { value: "webhook", label: "Webhook" },
  { value: "api", label: "API" },
  { value: "auth", label: "Auth" },
  { value: "data", label: "Data" },
  { value: "email", label: "Email" },
];

const STATUSES = [
  { value: "", label: "All statuses" },
  { value: "success", label: "Success" },
  { value: "delivered", label: "Delivered" },
  { value: "failed", label: "Failed" },
  { value: "pending", label: "Pending" },
  { value: "blocked", label: "Blocked" },
];

export function LogFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Local state — only pushed to URL on Submit
  const [category, setCategory] = useState(searchParams.get("category") ?? "");
  const [status, setStatus] = useState(searchParams.get("status") ?? "");
  const [eventType, setEventType] = useState(searchParams.get("event_type") ?? "");
  const [fromDate, setFromDate] = useState(searchParams.get("from") ?? "");
  const [toDate, setToDate] = useState(searchParams.get("to") ?? "");

  const hasLocalValues = !!(category || status || eventType || fromDate || toDate);
  const hasActiveFilters = !!(
    searchParams.get("category") ||
    searchParams.get("status") ||
    searchParams.get("event_type") ||
    searchParams.get("from") ||
    searchParams.get("to")
  );

  function submit() {
    const params = new URLSearchParams();
    if (category) params.set("category", category);
    if (status) params.set("status", status);
    if (eventType) params.set("event_type", eventType);
    if (fromDate) params.set("from", fromDate);
    if (toDate) params.set("to", toDate);
    router.push(`/dashboard/studio/logs?${params.toString()}`);
  }

  function clearAll() {
    setCategory("");
    setStatus("");
    setEventType("");
    setFromDate("");
    setToDate("");
    router.push("/dashboard/studio/logs");
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") submit();
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        {/* Category */}
        <div className="space-y-1">
          <label className="text-xs text-gray-500 dark:text-gray-400">Category</label>
          <Select value={category} onValueChange={(v) => setCategory(v ?? "")}>
            <SelectTrigger className="w-[140px] border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900 text-sm h-8">
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100">
              {CATEGORIES.map((c) => (
                <SelectItem key={c.value || "_all"} value={c.value} className="text-sm">
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Status */}
        <div className="space-y-1">
          <label className="text-xs text-gray-500 dark:text-gray-400">Status</label>
          <Select value={status} onValueChange={(v) => setStatus(v ?? "")}>
            <SelectTrigger className="w-[140px] border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900 text-sm h-8">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100">
              {STATUSES.map((s) => (
                <SelectItem key={s.value || "_all"} value={s.value} className="text-sm">
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Event type */}
        <div className="space-y-1">
          <label className="text-xs text-gray-500 dark:text-gray-400">Event type</label>
          <Input
            value={eventType}
            onChange={(e) => setEventType(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="e.g. item.created"
            className="w-[160px] border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900 text-sm h-8 font-mono"
          />
        </div>

        {/* From date */}
        <div className="space-y-1">
          <label className="text-xs text-gray-500 dark:text-gray-400">From</label>
          <Input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-[150px] border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900 text-sm h-8"
          />
        </div>

        {/* To date */}
        <div className="space-y-1">
          <label className="text-xs text-gray-500 dark:text-gray-400">To</label>
          <Input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-[150px] border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900 text-sm h-8"
          />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={submit}
            className="bg-blue-600 hover:bg-blue-700 text-white h-8 gap-1.5"
          >
            <Search className="h-3.5 w-3.5" />
            Search
          </Button>
          {(hasLocalValues || hasActiveFilters) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAll}
              className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 h-8 gap-1"
            >
              <X className="h-3 w-3" />
              Clear
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
