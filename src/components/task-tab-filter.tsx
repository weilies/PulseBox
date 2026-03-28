// src/components/task-tab-filter.tsx
"use client";

import { useRouter, useSearchParams } from "next/navigation";

const TABS = [
  { label: "All",    value: "" },
  { label: "Unread", value: "unread" },
  { label: "Done",   value: "done" },
] as const;

interface TaskTabFilterProps {
  activeStatus: string;
}

export function TaskTabFilter({ activeStatus }: TaskTabFilterProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function navigate(status: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", "1");
    if (status) {
      params.set("status", status);
    } else {
      params.delete("status");
    }
    router.push(`/dashboard/tasks?${params.toString()}`);
  }

  return (
    <div className="flex gap-1 rounded-lg border border-gray-200 bg-gray-100 p-1 w-fit">
      {TABS.map((tab) => {
        const isActive = activeStatus === tab.value;
        return (
          <button
            key={tab.value}
            onClick={() => navigate(tab.value)}
            className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
              isActive
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
            style={{ fontFamily: "var(--font-geist-sans), sans-serif" }}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
