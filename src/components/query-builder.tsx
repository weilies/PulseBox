"use client";

import { useState, useCallback, useEffect } from "react";
import {
 Plus, Trash2, Play, Save, ChevronDown, ChevronRight,
 Database, Link2, Filter, BarChart3, ArrowUpDown, Columns3,
 Loader2, Download, Globe, CheckCircle2, AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
 Select,
 SelectContent,
 SelectItem,
 SelectTrigger,
 SelectValue,
} from "@/components/ui/select";
import {
 Table,
 TableBody,
 TableCell,
 TableHead,
 TableHeader,
 TableRow,
} from "@/components/ui/table";
import type {
 QueryDefinition,
 QueryCollectionRef,
 QueryJoin,
 QueryField,
 QueryFilter,
 QueryAggregation,
 QueryGroupBy,
 QuerySort,
 QueryResult,
 QueryStatus,
 JoinType,
 FilterOperator,
 AggregateFunction,
 FilterLogic,
} from "@/types/queries";

/** Wraps a string callback to handle Select's `string | null` signature */
const nn = (fn: (v: string) => void) => (v: string | null) => { if (v) fn(v); };

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CollectionOption {
 id: string;
 slug: string;
 name: string;
 type: string;
 fields: { slug: string; name: string; field_type: string }[];
}

interface QueryBuilderProps {
 queryId?: string;
 initialName: string;
 initialDescription: string;
 initialDefinition: QueryDefinition;
 initialStatus: QueryStatus;
 isCreator: boolean;
 collections: CollectionOption[];
 onSave: (data: {
 name: string;
 description: string;
 definition: QueryDefinition;
 status: QueryStatus;
 }) => Promise<void>;
}

const ALIAS_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

const JOIN_TYPES: { value: JoinType; label: string; desc: string }[] = [
 { value: "inner", label: "INNER", desc: "Only matching rows" },
 { value: "left", label: "LEFT", desc: "All from left + matching right" },
 { value: "right", label: "RIGHT", desc: "All from right + matching left" },
 { value: "full", label: "FULL", desc: "All rows from both sides" },
];

const FILTER_OPERATORS: { value: FilterOperator; label: string }[] = [
 { value: "=", label: "equals" },
 { value: "!=", label: "not equals" },
 { value: ">", label: "greater than" },
 { value: "<", label: "less than" },
 { value: ">=", label: ">= " },
 { value: "<=", label: "<=" },
 { value: "contains", label: "contains" },
 { value: "starts_with", label: "starts with" },
 { value: "ends_with", label: "ends with" },
 { value: "is_null", label: "is empty" },
 { value: "is_not_null", label: "is not empty" },
];

const AGG_FUNCTIONS: { value: AggregateFunction; label: string }[] = [
 { value: "COUNT", label: "Count" },
 { value: "SUM", label: "Sum" },
 { value: "AVG", label: "Average" },
 { value: "MIN", label: "Min" },
 { value: "MAX", label: "Max" },
];

// ---------------------------------------------------------------------------
// Collapsible Section
// ---------------------------------------------------------------------------

function Section({
 icon: Icon,
 title,
 count,
 children,
 defaultOpen = true,
 badge,
}: {
 icon: React.ComponentType<{ className?: string }>;
 title: string;
 count?: number;
 children: React.ReactNode;
 defaultOpen?: boolean;
 badge?: string;
}) {
 const [open, setOpen] = useState(defaultOpen);
 return (
 <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden">
 <button
 onClick={() => setOpen((p) => !p)}
 className="flex w-full items-center gap-2.5 px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
 style={{ fontFamily: "var(--font-geist-sans), sans-serif" }}
 >
 <Icon className="h-4 w-4 text-blue-600 dark:text-blue-400" />
 {title}
 {count !== undefined && (
 <span className="ml-1 rounded-full bg-blue-50 dark:bg-blue-950 px-2 py-0.5 text-xs text-blue-600 dark:text-blue-400 font-medium">
 {count}
 </span>
 )}
 {badge && (
 <Badge variant="outline" className="ml-1 text-[10px] border-blue-200 text-blue-600 dark:text-blue-400">
 {badge}
 </Badge>
 )}
 <span className="ml-auto">
 {open ? <ChevronDown className="h-3.5 w-3.5 text-gray-400 dark:text-gray-500" /> : <ChevronRight className="h-3.5 w-3.5 text-gray-400 dark:text-gray-500" />}
 </span>
 </button>
 {open && <div className="border-t border-gray-100 dark:border-gray-800 px-4 py-3 space-y-3">{children}</div>}
 </div>
 );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function QueryBuilder({
 queryId,
 initialName,
 initialDescription,
 initialDefinition,
 initialStatus,
 isCreator,
 collections,
 onSave,
}: QueryBuilderProps) {
 const [name, setName] = useState(initialName);
 const [description, setDescription] = useState(initialDescription);
 const [status, setStatus] = useState<QueryStatus>(initialStatus);
 const [def, setDef] = useState<QueryDefinition>(initialDefinition);
 const [result, setResult] = useState<QueryResult | null>(null);
 const [running, setRunning] = useState(false);
 const [saving, setSaving] = useState(false);
 const [error, setError] = useState<string | null>(null);
 const [dirty, setDirty] = useState(false);

 // Mark dirty on any change
 useEffect(() => { setDirty(true); }, [def, name, description]);

 // Build a lookup: alias → CollectionOption
 const collectionByAlias = new Map<string, CollectionOption>();
 for (const ref of def.collections) {
 const col = collections.find((c) => c.id === ref.id);
 if (col) collectionByAlias.set(ref.alias, col);
 }

 // All available fields across selected collections
 const allFields: { alias: string; field: string; label: string; type: string }[] = [];
 for (const ref of def.collections) {
 const col = collectionByAlias.get(ref.alias);
 if (!col) continue;
 // System fields
 allFields.push({ alias: ref.alias, field: "_id", label: `${ref.alias}._id`, type: "text" });
 allFields.push({ alias: ref.alias, field: "_created_at", label: `${ref.alias}._created_at`, type: "datetime" });
 allFields.push({ alias: ref.alias, field: "_updated_at", label: `${ref.alias}._updated_at`, type: "datetime" });
 for (const f of col.fields) {
 allFields.push({ alias: ref.alias, field: f.slug, label: `${ref.alias}.${f.slug}`, type: f.field_type });
 }
 }

 // Get fields for a specific alias
 const getFieldsForAlias = (alias: string) => {
 const col = collectionByAlias.get(alias);
 if (!col) return [];
 return [
 { slug: "_id", name: "ID", field_type: "text" },
 { slug: "_created_at", name: "Created At", field_type: "datetime" },
 { slug: "_updated_at", name: "Updated At", field_type: "datetime" },
 ...col.fields,
 ];
 };

 // Next available alias letter
 const nextAlias = () => {
 const used = new Set(def.collections.map((c) => c.alias));
 return ALIAS_LETTERS.find((l) => !used.has(l)) ?? `T${def.collections.length}`;
 };

 // Update definition helper
 const update = useCallback((patch: Partial<QueryDefinition>) => {
 setDef((prev) => ({ ...prev, ...patch }));
 }, []);

 // -------------------------------------------------------------------------
 // Collections
 // -------------------------------------------------------------------------

 const addCollection = (colId: string | null) => {
 if (!colId) return;
 const col = collections.find((c) => c.id === colId);
 if (!col) return;
 if (def.collections.some((c) => c.id === colId)) return;
 const alias = nextAlias();
 update({ collections: [...def.collections, { id: col.id, slug: col.slug, alias }] });
 };

 const removeCollection = (alias: string) => {
 update({
 collections: def.collections.filter((c) => c.alias !== alias),
 joins: def.joins.filter((j) => j.left.alias !== alias && j.right.alias !== alias),
 fields: def.fields.filter((f) => f.alias !== alias),
 filters: def.filters.filter((f) => f.alias !== alias),
 aggregations: def.aggregations.filter((a) => a.alias !== alias),
 group_by: def.group_by.filter((g) => g.alias !== alias),
 sort: def.sort.filter((s) => s.alias !== alias),
 });
 };

 // -------------------------------------------------------------------------
 // Joins
 // -------------------------------------------------------------------------

 const addJoin = () => {
 if (def.collections.length < 2) return;
 const newJoin: QueryJoin = {
 type: "inner",
 left: { alias: def.collections[0].alias, field: "" },
 right: { alias: def.collections[1]?.alias ?? def.collections[0].alias, field: "" },
 };
 update({ joins: [...def.joins, newJoin] });
 };

 const updateJoin = (idx: number, patch: Partial<QueryJoin>) => {
 const joins = [...def.joins];
 joins[idx] = { ...joins[idx], ...patch };
 update({ joins });
 };

 const removeJoin = (idx: number) => {
 update({ joins: def.joins.filter((_, i) => i !== idx) });
 };

 // -------------------------------------------------------------------------
 // Fields
 // -------------------------------------------------------------------------

 const toggleField = (alias: string, field: string) => {
 const exists = def.fields.some((f) => f.alias === alias && f.field === field);
 if (exists) {
 update({ fields: def.fields.filter((f) => !(f.alias === alias && f.field === field)) });
 } else {
 update({ fields: [...def.fields, { alias, field }] });
 }
 };

 const selectAllFields = () => {
 const fields: QueryField[] = allFields.map((f) => ({ alias: f.alias, field: f.field }));
 update({ fields });
 };

 const clearAllFields = () => update({ fields: [] });

 // -------------------------------------------------------------------------
 // Filters
 // -------------------------------------------------------------------------

 const addFilter = () => {
 if (def.collections.length === 0) return;
 const newFilter: QueryFilter = {
 alias: def.collections[0].alias,
 field: "",
 operator: "=",
 value: "",
 logic: "and",
 };
 update({ filters: [...def.filters, newFilter] });
 };

 const updateFilter = (idx: number, patch: Partial<QueryFilter>) => {
 const filters = [...def.filters];
 filters[idx] = { ...filters[idx], ...patch };
 update({ filters });
 };

 const removeFilter = (idx: number) => {
 update({ filters: def.filters.filter((_, i) => i !== idx) });
 };

 // -------------------------------------------------------------------------
 // Aggregation
 // -------------------------------------------------------------------------

 const addAggregation = () => {
 if (def.collections.length === 0) return;
 const newAgg: QueryAggregation = {
 function: "COUNT",
 alias: def.collections[0].alias,
 field: "*",
 output_name: `count_${def.aggregations.length + 1}`,
 };
 update({ aggregations: [...def.aggregations, newAgg] });
 };

 const updateAggregation = (idx: number, patch: Partial<QueryAggregation>) => {
 const aggregations = [...def.aggregations];
 aggregations[idx] = { ...aggregations[idx], ...patch };
 update({ aggregations });
 };

 const removeAggregation = (idx: number) => {
 update({ aggregations: def.aggregations.filter((_, i) => i !== idx) });
 };

 const addGroupBy = () => {
 if (def.collections.length === 0) return;
 update({ group_by: [...def.group_by, { alias: def.collections[0].alias, field: "" }] });
 };

 const updateGroupBy = (idx: number, patch: Partial<QueryGroupBy>) => {
 const group_by = [...def.group_by];
 group_by[idx] = { ...group_by[idx], ...patch };
 update({ group_by });
 };

 const removeGroupBy = (idx: number) => {
 update({ group_by: def.group_by.filter((_, i) => i !== idx) });
 };

 // -------------------------------------------------------------------------
 // Sort
 // -------------------------------------------------------------------------

 const addSort = () => {
 if (def.collections.length === 0) return;
 update({
 sort: [
 ...def.sort,
 { alias: def.collections[0].alias, field: "", direction: "asc" as const },
 ],
 });
 };

 const updateSort = (idx: number, patch: Partial<QuerySort>) => {
 const sort = [...def.sort];
 sort[idx] = { ...sort[idx], ...patch };
 update({ sort });
 };

 const removeSort = (idx: number) => {
 update({ sort: def.sort.filter((_, i) => i !== idx) });
 };

 // -------------------------------------------------------------------------
 // Execute
 // -------------------------------------------------------------------------

 const handleRun = async () => {
 setRunning(true);
 setError(null);
 try {
 const endpoint = queryId
 ? `/api/queries/${queryId}/execute`
 : `/api/queries/preview/execute`;
 const res = await fetch(endpoint, {
 method: "POST",
 headers: { "Content-Type": "application/json" },
 body: JSON.stringify({ definition: def }),
 });
 const json = await res.json();
 if (!res.ok) throw new Error(json.error || "Execution failed");
 setResult(json.data);
 } catch (err) {
 setError(err instanceof Error ? err.message : "Unknown error");
 } finally {
 setRunning(false);
 }
 };

 const handleSave = async () => {
 setSaving(true);
 try {
 await onSave({ name, description, definition: def, status });
 setDirty(false);
 } finally {
 setSaving(false);
 }
 };

 const handlePublish = async () => {
 setSaving(true);
 try {
 await onSave({ name, description, definition: def, status: "published" });
 setStatus("published");
 setDirty(false);
 } finally {
 setSaving(false);
 }
 };

 const handleExport = async (format: "csv" | "json") => {
 if (!queryId) return;
 const res = await fetch(`/api/queries/${queryId}/export?format=${format}`);
 if (!res.ok) {
 const json = await res.json();
 setError(json.error || "Export failed");
 return;
 }

 if (format === "csv") {
 const blob = await res.blob();
 const url = URL.createObjectURL(blob);
 const a = document.createElement("a");
 a.href = url;
 a.download = `query-${queryId}.csv`;
 a.click();
 URL.revokeObjectURL(url);
 } else {
 const json = await res.json();
 const blob = new Blob([JSON.stringify(json, null, 2)], { type: "application/json" });
 const url = URL.createObjectURL(blob);
 const a = document.createElement("a");
 a.href = url;
 a.download = `query-${queryId}.json`;
 a.click();
 URL.revokeObjectURL(url);
 }
 };

 // -------------------------------------------------------------------------
 // Pseudo-SQL preview
 // -------------------------------------------------------------------------

 const buildPseudoSQL = () => {
 if (def.collections.length === 0) return "-- Add collections to build your query";

 const parts: string[] = [];

 // SELECT
 if (def.aggregations.length > 0) {
 const groupCols = def.group_by.map((g) => `${g.alias}.${g.field}`);
 const aggCols = def.aggregations.map(
 (a) => `${a.function}(${a.field === "*" ? "*" : `${a.alias}.${a.field}`}) AS ${a.output_name}`
 );
 parts.push(`SELECT ${[...groupCols, ...aggCols].join(", ")}`);
 } else if (def.fields.length > 0) {
 parts.push(`SELECT ${def.fields.map((f) => `${f.alias}.${f.field}`).join(", ")}`);
 } else {
 parts.push("SELECT *");
 }

 // FROM
 parts.push(`FROM ${def.collections[0]?.slug} AS ${def.collections[0]?.alias}`);

 // JOINs
 for (const join of def.joins) {
 const rightCol = def.collections.find((c) => c.alias === join.right.alias);
 parts.push(
 `${join.type.toUpperCase()} JOIN ${rightCol?.slug ?? "?"} AS ${join.right.alias} ON ${join.left.alias}.${join.left.field} = ${join.right.alias}.${join.right.field}`
 );
 }

 // WHERE
 if (def.filters.length > 0) {
 const conditions = def.filters.map((f, i) => {
 const cond = `${f.alias}.${f.field} ${f.operator} ${JSON.stringify(f.value)}`;
 return i === 0 ? cond : `${def.filters[i - 1].logic.toUpperCase()} ${cond}`;
 });
 parts.push(`WHERE ${conditions.join(" ")}`);
 }

 // GROUP BY
 if (def.group_by.length > 0) {
 parts.push(`GROUP BY ${def.group_by.map((g) => `${g.alias}.${g.field}`).join(", ")}`);
 }

 // ORDER BY
 if (def.sort.length > 0) {
 parts.push(`ORDER BY ${def.sort.map((s) => `${s.alias}.${s.field} ${s.direction.toUpperCase()}`).join(", ")}`);
 }

 // LIMIT
 parts.push(`LIMIT ${def.limit}`);

 return parts.join("\n");
 };

 // -------------------------------------------------------------------------
 // Render
 // -------------------------------------------------------------------------

 return (
 <div className="space-y-4">
 {/* Header bar */}
 <div className="flex items-center gap-3 flex-wrap">
 <div className="flex-1 min-w-[200px]">
 <Input
 value={name}
 onChange={(e) => setName(e.target.value)}
 placeholder="Query name..."
 className="text-lg font-semibold border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 h-10"
 style={{ fontFamily: "var(--font-geist-sans), sans-serif" }}
 disabled={!isCreator}
 />
 </div>
 <div className="flex items-center gap-2">
 {status === "published" ? (
 <Badge className="bg-emerald-50 text-emerald-600 border border-emerald-200 gap-1">
 <Globe className="h-3 w-3" /> Published
 </Badge>
 ) : (
 <Badge className="bg-amber-50 text-amber-600 border border-amber-200">Draft</Badge>
 )}
 <Button
 onClick={handleRun}
 disabled={running || def.collections.length === 0}
 className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5"
 size="sm"
 >
 {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
 Test
 </Button>
 {isCreator && (
 <>
 <Button
 onClick={handleSave}
 disabled={saving}
 variant="outline"
 size="sm"
 className="border-gray-200 dark:border-gray-700 text-gray-700 gap-1.5"
 >
 <Save className="h-3.5 w-3.5" />
 Save
 </Button>
 {status === "draft" && (
 <Button
 onClick={handlePublish}
 disabled={saving || def.collections.length === 0}
 size="sm"
 className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
 >
 <CheckCircle2 className="h-3.5 w-3.5" />
 Publish
 </Button>
 )}
 </>
 )}
 {queryId && status === "published" && (
 <Select onValueChange={nn((v) => handleExport(v as "csv" | "json"))}>
 <SelectTrigger className="w-[100px] h-8 border-gray-200 dark:border-gray-700 text-gray-700 text-xs">
 <Download className="h-3 w-3 mr-1" />
 Export
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="csv">CSV</SelectItem>
 <SelectItem value="json">JSON</SelectItem>
 </SelectContent>
 </Select>
 )}
 </div>
 </div>

 {/* Description */}
 <Input
 value={description}
 onChange={(e) => setDescription(e.target.value)}
 placeholder="Description (optional)..."
 className="border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 text-sm"
 disabled={!isCreator}
 />

 {/* Error banner */}
 {error && (
 <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-600 dark:text-red-400">
 <AlertCircle className="h-4 w-4 shrink-0" />
 {error}
 <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600 dark:hover:text-red-400 dark:text-red-400">
 <Trash2 className="h-3.5 w-3.5" />
 </button>
 </div>
 )}

 <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
 {/* Left column: Builder */}
 <div className="lg:col-span-2 space-y-3">
 {/* Collections */}
 <Section icon={Database} title="Collections" count={def.collections.length}>
 <div className="flex flex-wrap gap-2">
 {def.collections.map((ref) => {
 const col = collections.find((c) => c.id === ref.id);
 return (
 <div
 key={ref.alias}
 className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-950 px-3 py-1.5"
 >
 <span className="inline-flex items-center justify-center h-5 w-5 rounded bg-blue-600 text-white text-xs font-bold">
 {ref.alias}
 </span>
 <span className="text-sm font-medium text-gray-800">{col?.name ?? ref.slug}</span>
 <span className="text-[10px] text-blue-500 dark:text-blue-400 font-mono">{ref.slug}</span>
 {col?.type === "system" && (
 <Badge variant="outline" className="text-[9px] border-blue-300 text-blue-500 dark:text-blue-400 px-1 py-0">SYS</Badge>
 )}
 {isCreator && (
 <button onClick={() => removeCollection(ref.alias)} className="text-red-400 hover:text-red-600 dark:hover:text-red-400 dark:text-red-400 ml-1">
 <Trash2 className="h-3 w-3" />
 </button>
 )}
 </div>
 );
 })}
 </div>
 {isCreator && (
 <Select onValueChange={addCollection}>
 <SelectTrigger className="w-full border-dashed border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 text-sm h-9">
 <Plus className="h-3.5 w-3.5 mr-1.5" />
 Add collection...
 </SelectTrigger>
 <SelectContent>
 {collections
 .filter((c) => !def.collections.some((dc) => dc.id === c.id))
 .map((c) => (
 <SelectItem key={c.id} value={c.id}>
 <span className="flex items-center gap-2">
 {c.name}
 <span className="text-[10px] text-gray-400 dark:text-gray-500 font-mono">{c.slug}</span>
 {c.type === "system" && (
 <Badge variant="outline" className="text-[9px] ml-1">SYS</Badge>
 )}
 </span>
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 )}
 </Section>

 {/* Joins */}
 {def.collections.length >= 2 && (
 <Section icon={Link2} title="Joins" count={def.joins.length}>
 {def.joins.map((join, idx) => (
 <div key={idx} className="flex items-center gap-2 flex-wrap rounded-md border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 p-2.5">
 {/* Left side */}
 <Select
 value={join.left.alias}
 onValueChange={nn((v) => updateJoin(idx, { left: { ...join.left, alias: v } }))}
 >
 <SelectTrigger className="w-16 h-8 text-xs border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900"><SelectValue /></SelectTrigger>
 <SelectContent>
 {def.collections.map((c) => <SelectItem key={c.alias} value={c.alias}>{c.alias}</SelectItem>)}
 </SelectContent>
 </Select>
 <span className="text-gray-400 dark:text-gray-500">.</span>
 <Select
 value={join.left.field}
 onValueChange={nn((v) => updateJoin(idx, { left: { ...join.left, field: v } }))}
 >
 <SelectTrigger className="w-36 h-8 text-xs border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
 <SelectValue placeholder="field..." />
 </SelectTrigger>
 <SelectContent>
 {getFieldsForAlias(join.left.alias).map((f) => (
 <SelectItem key={f.slug} value={f.slug}>{f.name} <span className="text-gray-400 dark:text-gray-500 text-[10px] ml-1">{f.field_type}</span></SelectItem>
 ))}
 </SelectContent>
 </Select>

 {/* Join type */}
 <Select
 value={join.type}
 onValueChange={nn((v) => updateJoin(idx, { type: v as JoinType }))}
 >
 <SelectTrigger className="w-24 h-8 text-xs font-mono border-blue-200 bg-blue-50 dark:bg-blue-950 text-blue-700">
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 {JOIN_TYPES.map((jt) => (
 <SelectItem key={jt.value} value={jt.value}>
 <span className="font-mono">{jt.label}</span>
 <span className="text-gray-400 dark:text-gray-500 text-[10px] ml-2">{jt.desc}</span>
 </SelectItem>
 ))}
 </SelectContent>
 </Select>

 {/* Right side */}
 <Select
 value={join.right.alias}
 onValueChange={nn((v) => updateJoin(idx, { right: { ...join.right, alias: v } }))}
 >
 <SelectTrigger className="w-16 h-8 text-xs border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900"><SelectValue /></SelectTrigger>
 <SelectContent>
 {def.collections.map((c) => <SelectItem key={c.alias} value={c.alias}>{c.alias}</SelectItem>)}
 </SelectContent>
 </Select>
 <span className="text-gray-400 dark:text-gray-500">.</span>
 <Select
 value={join.right.field}
 onValueChange={nn((v) => updateJoin(idx, { right: { ...join.right, field: v } }))}
 >
 <SelectTrigger className="w-36 h-8 text-xs border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
 <SelectValue placeholder="field..." />
 </SelectTrigger>
 <SelectContent>
 {getFieldsForAlias(join.right.alias).map((f) => (
 <SelectItem key={f.slug} value={f.slug}>{f.name} <span className="text-gray-400 dark:text-gray-500 text-[10px] ml-1">{f.field_type}</span></SelectItem>
 ))}
 </SelectContent>
 </Select>

 {isCreator && (
 <button onClick={() => removeJoin(idx)} className="text-red-400 hover:text-red-600 dark:hover:text-red-400 dark:text-red-400 ml-auto">
 <Trash2 className="h-3.5 w-3.5" />
 </button>
 )}
 </div>
 ))}
 {isCreator && (
 <Button onClick={addJoin} variant="outline" size="sm" className="border-dashed border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 text-xs w-full">
 <Plus className="h-3 w-3 mr-1" /> Add Join
 </Button>
 )}
 </Section>
 )}

 {/* Fields */}
 {def.collections.length > 0 && (
 <Section icon={Columns3} title="Fields" count={def.fields.length} badge={def.fields.length === 0 ? "all" : undefined}>
 <div className="flex gap-2 mb-2">
 <Button onClick={selectAllFields} variant="outline" size="sm" className="text-xs border-gray-200 dark:border-gray-700 text-gray-600 h-7">
 Select All
 </Button>
 <Button onClick={clearAllFields} variant="outline" size="sm" className="text-xs border-gray-200 dark:border-gray-700 text-gray-600 h-7">
 Clear
 </Button>
 </div>
 <div className="grid grid-cols-2 sm:grid-cols-3 gap-1">
 {allFields.map((f) => {
 const selected = def.fields.some((sf) => sf.alias === f.alias && sf.field === f.field);
 return (
 <button
 key={f.label}
 onClick={() => toggleField(f.alias, f.field)}
 className={`flex items-center gap-1.5 rounded px-2 py-1 text-xs transition-colors ${
 selected
 ? "bg-blue-50 dark:bg-blue-950 text-blue-700 border border-blue-200"
 : "bg-gray-50 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400 border border-transparent hover:border-gray-200 dark:border-gray-700"
 }`}
 >
 <span className="inline-flex items-center justify-center h-4 w-4 rounded bg-gray-200 text-[9px] font-bold text-gray-600 shrink-0">
 {f.alias}
 </span>
 <span className="truncate">{f.field}</span>
 <span className="text-[9px] text-gray-400 dark:text-gray-500 ml-auto">{f.type}</span>
 </button>
 );
 })}
 </div>
 </Section>
 )}

 {/* Filters */}
 {def.collections.length > 0 && (
 <Section icon={Filter} title="Filters" count={def.filters.length} defaultOpen={def.filters.length > 0}>
 {def.filters.map((filter, idx) => (
 <div key={idx} className="flex items-center gap-2 flex-wrap">
 {idx > 0 && (
 <Select
 value={def.filters[idx - 1].logic}
 onValueChange={nn((v) => updateFilter(idx - 1, { logic: v as FilterLogic }))}
 >
 <SelectTrigger className="w-16 h-7 text-[10px] font-mono border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="and">AND</SelectItem>
 <SelectItem value="or">OR</SelectItem>
 </SelectContent>
 </Select>
 )}
 <Select
 value={filter.alias}
 onValueChange={nn((v) => updateFilter(idx, { alias: v }))}
 >
 <SelectTrigger className="w-16 h-8 text-xs border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900"><SelectValue /></SelectTrigger>
 <SelectContent>
 {def.collections.map((c) => <SelectItem key={c.alias} value={c.alias}>{c.alias}</SelectItem>)}
 </SelectContent>
 </Select>
 <span className="text-gray-400 dark:text-gray-500">.</span>
 <Select
 value={filter.field}
 onValueChange={nn((v) => updateFilter(idx, { field: v }))}
 >
 <SelectTrigger className="w-32 h-8 text-xs border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
 <SelectValue placeholder="field..." />
 </SelectTrigger>
 <SelectContent>
 {getFieldsForAlias(filter.alias).map((f) => (
 <SelectItem key={f.slug} value={f.slug}>{f.name}</SelectItem>
 ))}
 </SelectContent>
 </Select>
 <Select
 value={filter.operator}
 onValueChange={nn((v) => updateFilter(idx, { operator: v as FilterOperator }))}
 >
 <SelectTrigger className="w-28 h-8 text-xs border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 {FILTER_OPERATORS.map((op) => (
 <SelectItem key={op.value} value={op.value}>{op.label}</SelectItem>
 ))}
 </SelectContent>
 </Select>
 {!["is_null", "is_not_null"].includes(filter.operator) && (
 <Input
 value={String(filter.value ?? "")}
 onChange={(e) => updateFilter(idx, { value: e.target.value })}
 placeholder="value..."
 className="w-32 h-8 text-xs border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900"
 />
 )}
 <button onClick={() => removeFilter(idx)} className="text-red-400 hover:text-red-600 dark:hover:text-red-400 dark:text-red-400">
 <Trash2 className="h-3.5 w-3.5" />
 </button>
 </div>
 ))}
 {isCreator && (
 <Button onClick={addFilter} variant="outline" size="sm" className="border-dashed border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 text-xs w-full">
 <Plus className="h-3 w-3 mr-1" /> Add Filter
 </Button>
 )}
 </Section>
 )}

 {/* Aggregation */}
 {def.collections.length > 0 && (
 <Section icon={BarChart3} title="Aggregation" count={def.aggregations.length} defaultOpen={def.aggregations.length > 0} badge="optional">
 {/* Group By */}
 <Label className="text-xs text-gray-500 dark:text-gray-400 font-medium">Group By</Label>
 {def.group_by.map((gb, idx) => (
 <div key={idx} className="flex items-center gap-2">
 <Select value={gb.alias} onValueChange={nn((v) => updateGroupBy(idx, { alias: v }))}>
 <SelectTrigger className="w-16 h-8 text-xs border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900"><SelectValue /></SelectTrigger>
 <SelectContent>
 {def.collections.map((c) => <SelectItem key={c.alias} value={c.alias}>{c.alias}</SelectItem>)}
 </SelectContent>
 </Select>
 <span className="text-gray-400 dark:text-gray-500">.</span>
 <Select value={gb.field} onValueChange={nn((v) => updateGroupBy(idx, { field: v }))}>
 <SelectTrigger className="w-40 h-8 text-xs border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
 <SelectValue placeholder="field..." />
 </SelectTrigger>
 <SelectContent>
 {getFieldsForAlias(gb.alias).map((f) => (
 <SelectItem key={f.slug} value={f.slug}>{f.name}</SelectItem>
 ))}
 </SelectContent>
 </Select>
 <button onClick={() => removeGroupBy(idx)} className="text-red-400 hover:text-red-600 dark:hover:text-red-400 dark:text-red-400">
 <Trash2 className="h-3.5 w-3.5" />
 </button>
 </div>
 ))}
 <Button onClick={addGroupBy} variant="outline" size="sm" className="border-dashed border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 text-xs">
 <Plus className="h-3 w-3 mr-1" /> Add Group
 </Button>

 {/* Aggregate functions */}
 <Label className="text-xs text-gray-500 dark:text-gray-400 font-medium mt-2">Aggregate Functions</Label>
 {def.aggregations.map((agg, idx) => (
 <div key={idx} className="flex items-center gap-2 flex-wrap">
 <Select value={agg.function} onValueChange={nn((v) => updateAggregation(idx, { function: v as AggregateFunction }))}>
 <SelectTrigger className="w-24 h-8 text-xs font-mono border-blue-200 bg-blue-50 dark:bg-blue-950 text-blue-700">
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 {AGG_FUNCTIONS.map((af) => <SelectItem key={af.value} value={af.value}>{af.label}</SelectItem>)}
 </SelectContent>
 </Select>
 <span className="text-gray-400 dark:text-gray-500">(</span>
 {agg.function === "COUNT" ? (
 <Select value={agg.field} onValueChange={nn((v) => updateAggregation(idx, { field: v, alias: v === "*" ? agg.alias : v.split(".")[0] || agg.alias }))}>
 <SelectTrigger className="w-36 h-8 text-xs border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="*">* (all rows)</SelectItem>
 {allFields.map((f) => <SelectItem key={f.label} value={f.field}>{f.label}</SelectItem>)}
 </SelectContent>
 </Select>
 ) : (
 <>
 <Select value={agg.alias} onValueChange={nn((v) => updateAggregation(idx, { alias: v }))}>
 <SelectTrigger className="w-16 h-8 text-xs border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900"><SelectValue /></SelectTrigger>
 <SelectContent>
 {def.collections.map((c) => <SelectItem key={c.alias} value={c.alias}>{c.alias}</SelectItem>)}
 </SelectContent>
 </Select>
 <span className="text-gray-400 dark:text-gray-500">.</span>
 <Select value={agg.field} onValueChange={nn((v) => updateAggregation(idx, { field: v }))}>
 <SelectTrigger className="w-32 h-8 text-xs border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
 <SelectValue placeholder="field..." />
 </SelectTrigger>
 <SelectContent>
 {getFieldsForAlias(agg.alias).map((f) => (
 <SelectItem key={f.slug} value={f.slug}>{f.name}</SelectItem>
 ))}
 </SelectContent>
 </Select>
 </>
 )}
 <span className="text-gray-400 dark:text-gray-500">)</span>
 <span className="text-xs text-gray-400 dark:text-gray-500">AS</span>
 <Input
 value={agg.output_name}
 onChange={(e) => updateAggregation(idx, { output_name: e.target.value })}
 className="w-28 h-8 text-xs border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 font-mono"
 placeholder="alias..."
 />
 <button onClick={() => removeAggregation(idx)} className="text-red-400 hover:text-red-600 dark:hover:text-red-400 dark:text-red-400">
 <Trash2 className="h-3.5 w-3.5" />
 </button>
 </div>
 ))}
 <Button onClick={addAggregation} variant="outline" size="sm" className="border-dashed border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 text-xs">
 <Plus className="h-3 w-3 mr-1" /> Add Aggregation
 </Button>
 </Section>
 )}

 {/* Sort */}
 {def.collections.length > 0 && (
 <Section icon={ArrowUpDown} title="Sort" count={def.sort.length} defaultOpen={def.sort.length > 0}>
 {def.sort.map((s, idx) => (
 <div key={idx} className="flex items-center gap-2">
 <Select value={s.alias} onValueChange={nn((v) => updateSort(idx, { alias: v }))}>
 <SelectTrigger className="w-16 h-8 text-xs border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900"><SelectValue /></SelectTrigger>
 <SelectContent>
 {def.collections.map((c) => <SelectItem key={c.alias} value={c.alias}>{c.alias}</SelectItem>)}
 </SelectContent>
 </Select>
 <span className="text-gray-400 dark:text-gray-500">.</span>
 <Select value={s.field} onValueChange={nn((v) => updateSort(idx, { field: v }))}>
 <SelectTrigger className="w-40 h-8 text-xs border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
 <SelectValue placeholder="field..." />
 </SelectTrigger>
 <SelectContent>
 {getFieldsForAlias(s.alias).map((f) => (
 <SelectItem key={f.slug} value={f.slug}>{f.name}</SelectItem>
 ))}
 </SelectContent>
 </Select>
 <Select value={s.direction} onValueChange={nn((v) => updateSort(idx, { direction: v as "asc" | "desc" }))}>
 <SelectTrigger className="w-20 h-8 text-xs border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900"><SelectValue /></SelectTrigger>
 <SelectContent>
 <SelectItem value="asc">ASC</SelectItem>
 <SelectItem value="desc">DESC</SelectItem>
 </SelectContent>
 </Select>
 <button onClick={() => removeSort(idx)} className="text-red-400 hover:text-red-600 dark:hover:text-red-400 dark:text-red-400">
 <Trash2 className="h-3.5 w-3.5" />
 </button>
 </div>
 ))}
 {isCreator && (
 <Button onClick={addSort} variant="outline" size="sm" className="border-dashed border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 text-xs w-full">
 <Plus className="h-3 w-3 mr-1" /> Add Sort
 </Button>
 )}
 </Section>
 )}

 {/* Limit */}
 {def.collections.length > 0 && (
 <div className="flex items-center gap-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2.5">
 <Label className="text-sm text-gray-600 font-medium whitespace-nowrap">Row Limit</Label>
 <Input
 type="number"
 value={def.limit}
 onChange={(e) => update({ limit: Math.max(1, Math.min(5000, Number(e.target.value) || 500)) })}
 className="w-24 h-8 text-sm border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700"
 min={1}
 max={5000}
 disabled={!isCreator}
 />
 <span className="text-xs text-gray-400 dark:text-gray-500">max 5,000</span>
 </div>
 )}
 </div>

 {/* Right column: SQL Preview */}
 <div className="space-y-3">
 <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-900 overflow-hidden sticky top-4">
 <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-700">
 <div className="h-2.5 w-2.5 rounded-full bg-red-400" />
 <div className="h-2.5 w-2.5 rounded-full bg-amber-400" />
 <div className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
 <span className="text-[10px] text-gray-500 dark:text-gray-400 ml-2 font-mono">query preview</span>
 </div>
 <pre className="p-4 text-xs text-emerald-400 font-mono leading-relaxed overflow-x-auto whitespace-pre-wrap">
 {buildPseudoSQL()}
 </pre>
 </div>

 {/* Quick stats */}
 {def.collections.length > 0 && (
 <div className="grid grid-cols-2 gap-2">
 <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3 text-center">
 <div className="text-lg font-bold text-gray-900 dark:text-gray-100">{def.collections.length}</div>
 <div className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wide">Collections</div>
 </div>
 <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3 text-center">
 <div className="text-lg font-bold text-gray-900 dark:text-gray-100">{def.joins.length}</div>
 <div className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wide">Joins</div>
 </div>
 <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3 text-center">
 <div className="text-lg font-bold text-gray-900 dark:text-gray-100">{def.filters.length}</div>
 <div className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wide">Filters</div>
 </div>
 <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3 text-center">
 <div className="text-lg font-bold text-gray-900 dark:text-gray-100">{def.fields.length || "All"}</div>
 <div className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wide">Fields</div>
 </div>
 </div>
 )}
 </div>
 </div>

 {/* Results */}
 {result && (
 <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden">
 <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
 <div className="flex items-center gap-3">
 <span className="text-sm font-semibold text-gray-700" style={{ fontFamily: "var(--font-geist-sans), sans-serif" }}>
 Results
 </span>
 <Badge variant="outline" className="text-[10px] border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400">
 {result.total} rows
 </Badge>
 <Badge variant="outline" className="text-[10px] border-emerald-300 text-emerald-500">
 {result.execution_ms}ms
 </Badge>
 </div>
 </div>
 {result.rows.length > 0 ? (
 <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
 <Table>
 <TableHeader className="bg-gray-100 dark:bg-gray-800 sticky top-0">
 <TableRow className="border-gray-200 dark:border-gray-700 hover:bg-transparent">
 <TableHead className="text-gray-500 dark:text-gray-400 text-xs w-12 text-center">#</TableHead>
 {result.columns.map((col) => (
 <TableHead key={col} className="text-gray-500 dark:text-gray-400 text-xs font-mono whitespace-nowrap">
 {col}
 </TableHead>
 ))}
 </TableRow>
 </TableHeader>
 <TableBody>
 {result.rows.map((row, i) => (
 <TableRow
 key={i}
 className={`border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 ${i % 2 === 0 ? "bg-white dark:bg-gray-900" : "bg-gray-50 dark:bg-gray-800/50"}`}
 >
 <TableCell className="text-gray-400 dark:text-gray-500 text-xs text-center">{i + 1}</TableCell>
 {result.columns.map((col) => (
 <TableCell key={col} className="text-gray-700 text-xs font-mono max-w-[200px] truncate">
 {row[col] == null ? (
 <span className="text-gray-300 italic">null</span>
 ) : (
 String(row[col])
 )}
 </TableCell>
 ))}
 </TableRow>
 ))}
 </TableBody>
 </Table>
 </div>
 ) : (
 <div className="text-center text-gray-500 dark:text-gray-400 py-10 text-sm">No rows returned</div>
 )}
 </div>
 )}
 </div>
 );
}