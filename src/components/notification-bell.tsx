"use client";

import { useState, useEffect, useCallback } from "react";
import { Bell } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface Task {
  id: string;
  title: string;
  body: string | null;
  action_url: string | null;
  action_label: string | null;
  status: "unread" | "read" | "done";
  created_at: string;
}

interface NotificationBellProps {
  tenantId: string;
}

function relativeTime(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function NotificationBell({ tenantId }: NotificationBellProps) {
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [marking, setMarking] = useState(false);

  const getHeaders = useCallback(async (): Promise<HeadersInit | null> => {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return null;
    return {
      Authorization: `Bearer ${session.access_token}`,
      "X-Tenant-Id": tenantId,
    };
  }, [tenantId]);

  const fetchTasks = useCallback(async () => {
    const headers = await getHeaders();
    if (!headers) return;

    const res = await fetch("/api/tasks?limit=10", { headers });
    if (!res.ok) return;
    const json = await res.json();
    setTasks(json.data ?? []);
    setUnreadCount(json.unread_count ?? 0);
  }, [getHeaders]);

  useEffect(() => {
    fetchTasks();
    const interval = setInterval(fetchTasks, 60_000);
    return () => clearInterval(interval);
  }, [fetchTasks]);

  async function handleTaskClick(task: Task) {
    const headers = await getHeaders();
    if (!headers) return;

    // Only PATCH if currently unread
    if (task.status === "unread") {
      await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ status: "read" }),
      });
      await fetchTasks();
    }

    if (task.action_url) {
      setOpen(false);
      router.push(task.action_url);
    }
  }

  async function handleMarkAllRead() {
    setMarking(true);
    const headers = await getHeaders();
    if (headers) {
      const res = await fetch("/api/tasks/mark-all-read", { method: "POST", headers });
      if (!res.ok) {
        toast.error("Failed to mark notifications as read");
      } else {
        await fetchTasks();
      }
    }
    setMarking(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      {/* PopoverTrigger renders its own <button> via @base-ui/react — asChild is not supported.
          className and aria-label are applied directly to that button element. */}
      <PopoverTrigger
        className="relative inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
      >
        <Bell className="h-4 w-4 text-gray-600 dark:text-gray-400" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-0.5 text-[10px] font-bold text-white leading-none">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </PopoverTrigger>

      <PopoverContent
        align="end"
        className="w-80 p-0 bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700"
      >
        {/* Header row */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <span
            className="text-sm font-semibold text-gray-900 dark:text-gray-100"
            style={{ fontFamily: "var(--font-geist-sans), sans-serif" }}
          >
            Notifications
          </span>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              disabled={marking}
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50 transition-opacity"
            >
              Mark all read
            </button>
          )}
        </div>

        {/* Task list */}
        <div className="max-h-80 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800">
          {tasks.length === 0 ? (
            <p className="text-center text-gray-500 dark:text-gray-400 py-10 text-sm">
              No notifications
            </p>
          ) : (
            tasks.map((task) => (
              <button
                key={task.id}
                type="button"
                onClick={() => handleTaskClick(task)}
                className={`w-full text-left px-4 py-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors ${
                  task.status === "unread" ? "bg-blue-50/50 dark:bg-blue-950/20" : ""
                }`}
              >
                <div className="flex items-start gap-2">
                  {task.status === "unread" && (
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-500" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p
                        className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate"
                        style={{ fontFamily: "var(--font-geist-sans), sans-serif" }}
                      >
                        {task.title}
                      </p>
                      <span className="text-[10px] text-gray-400 dark:text-gray-500 whitespace-nowrap shrink-0 mt-0.5">
                        {relativeTime(task.created_at)}
                      </span>
                    </div>
                    {task.body && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                        {task.body}
                      </p>
                    )}
                    {task.action_label && task.action_url && (
                      <p className="mt-1 text-xs text-blue-600 dark:text-blue-400">
                        {task.action_label} →
                      </p>
                    )}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700 text-center">
          <button
            onClick={() => { setOpen(false); router.push("/dashboard/tasks"); }}
            className="text-xs text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          >
            View all →
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
