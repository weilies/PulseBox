import { getUser } from "@/lib/auth";
import { notFound } from "next/navigation";
import { ScrollText } from "lucide-react";
import { resolveTimezone } from "@/lib/timezone";
import { getCurrentTenantId } from "@/lib/tenant";
import { getActivityLogs } from "@/app/actions/webhooks";
import { LogFilters } from "@/components/log-filters";
import { LogRow } from "@/components/log-row";
import { Suspense } from "react";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PAGE_SIZE } from "@/lib/data-grid";
import { TablePagination } from "@/components/table-pagination";

export default async function ActivityLogPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getUser();
  if (!user) notFound();

  const tenantId = await getCurrentTenantId();
  const timezone = await resolveTimezone(user.id, tenantId ?? "");

  const params = await searchParams;
  const category = typeof params.category === "string" ? params.category : undefined;
  const eventType = typeof params.event_type === "string" ? params.event_type : undefined;
  const status = typeof params.status === "string" ? params.status : undefined;
  const fromDate = typeof params.from === "string" ? params.from : undefined;
  const toDate = typeof params.to === "string" ? params.to : undefined;
  const page = Math.max(1, parseInt(String(params.page ?? "1")));

  // Fetch a large window for merge-sort pagination (both tables merged in app code)
  const { entries: allLogs, totalCount } = await getActivityLogs(500, {
    category: category || undefined,
    event_type: eventType || undefined,
    status: status || undefined,
    from_date: fromDate || undefined,
    to_date: toDate || undefined,
  });

  const totalItems = totalCount;
  const totalPages = Math.ceil(totalItems / PAGE_SIZE);
  const logs = allLogs.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Build current filter params for pagination links
  const filterParams: Record<string, string> = {};
  if (category) filterParams.category = category;
  if (eventType) filterParams.event_type = eventType;
  if (status) filterParams.status = status;
  if (fromDate) filterParams.from = fromDate;
  if (toDate) filterParams.to = toDate;

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="rounded-md border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-800 p-2">
          <ScrollText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100" style={{ fontFamily: "var(--font-geist-sans), sans-serif" }}>
            Activity Log
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            All event logs across webhooks, API, auth, and system events
          </p>
        </div>
      </div>

      {/* Filters */}
      <Suspense>
        <LogFilters />
      </Suspense>

      {/* Results count */}
      <p className="text-xs text-gray-400 dark:text-gray-500">
        {totalItems} {totalItems === 1 ? "entry" : "entries"}
        {(category || eventType || status || fromDate || toDate) && " (filtered)"}
        {logs.some((l) => l.request_body) && (
          <span className="ml-2 text-gray-300 dark:text-gray-600">· Click a row to view payload</span>
        )}
      </p>

      {/* Log table */}
      {logs.length === 0 ? (
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 py-16 text-center">
          <ScrollText className="h-8 w-8 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-sm text-gray-500 dark:text-gray-400">No log entries found.</p>
        </div>
      ) : (
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <Table>
            <TableHeader className="bg-gray-100 dark:bg-gray-800">
              <TableRow className="border-gray-200 dark:border-gray-700 hover:bg-transparent">
                <TableHead className="w-8" />
                <TableHead className="text-gray-500 dark:text-gray-400 w-[160px]">Timestamp</TableHead>
                <TableHead className="text-gray-500 dark:text-gray-400 w-[90px]">Category</TableHead>
                <TableHead className="text-gray-500 dark:text-gray-400">Event</TableHead>
                <TableHead className="text-gray-500 dark:text-gray-400 w-[90px]">Status</TableHead>
                <TableHead className="text-gray-500 dark:text-gray-400 w-[60px] text-right">HTTP</TableHead>
                <TableHead className="text-gray-500 dark:text-gray-400 w-[70px] text-right">Duration</TableHead>
                <TableHead className="text-gray-500 dark:text-gray-400">Scope</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log, i) => (
                <LogRow key={log.id} log={log} isEven={i % 2 === 0} timezone={timezone} />
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <TablePagination
        currentPage={page}
        totalPages={totalPages}
        totalItems={totalItems}
        basePath="/dashboard/studio/logs"
        sortCol="created_at"
        ascending={false}
        currentParams={filterParams}
      />
    </div>
  );
}
