"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { QueryBuilder } from "@/components/query-builder";
import { EMPTY_DEFINITION } from "@/types/queries";
import { ArrowLeft, Workflow } from "lucide-react";
import Link from "next/link";
import type { QueryDefinition, QueryStatus, SavedQuery } from "@/types/queries";

interface CollectionOption {
 id: string;
 slug: string;
 name: string;
 type: string;
 fields: { slug: string; name: string; field_type: string }[];
}

export default function EditQueryPage() {
 const params = useParams();
 const router = useRouter();
 const queryId = params.id as string;

 const [query, setQuery] = useState<SavedQuery | null>(null);
 const [collections, setCollections] = useState<CollectionOption[]>([]);
 const [loading, setLoading] = useState(true);
 const [currentUserId, setCurrentUserId] = useState<string | null>(null);
 const [error, setError] = useState<string | null>(null);

 useEffect(() => {
 async function load() {
 try {
 const [queryRes, collectionsRes, userRes] = await Promise.all([
 fetch(`/api/queries/${queryId}`),
 fetch("/api/queries/collections"),
 fetch("/api/auth/me"),
 ]);

 if (!queryRes.ok) {
 setError("Query not found or access denied");
 return;
 }

 const queryJson = await queryRes.json();
 setQuery(queryJson.data);

 if (collectionsRes.ok) {
 const colJson = await collectionsRes.json();
 setCollections(colJson.data ?? []);
 }

 if (userRes.ok) {
 const userJson = await userRes.json();
 setCurrentUserId(userJson.id ?? null);
 }
 } catch {
 setError("Failed to load query");
 } finally {
 setLoading(false);
 }
 }
 load();
 }, [queryId]);

 const handleSave = async (data: {
 name: string;
 description: string;
 definition: QueryDefinition;
 status: QueryStatus;
 }) => {
 const res = await fetch(`/api/queries/${queryId}`, {
 method: "PATCH",
 headers: { "Content-Type": "application/json" },
 body: JSON.stringify({
 name: data.name,
 description: data.description,
 definition: data.definition,
 status: data.status,
 }),
 });

 const json = await res.json();
 if (!res.ok) throw new Error(json.error);

 setQuery(json.data);
 };

 if (loading) {
 return (
 <div className="p-6 flex items-center justify-center min-h-[400px]">
 <div className="text-gray-400 dark:text-gray-500 text-sm">Loading query...</div>
 </div>
 );
 }

 if (error || !query) {
 return (
 <div className="p-6 space-y-4 max-w-5xl">
 <Link
 href="/dashboard/studio/queries"
 className="text-sm text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 dark:text-blue-400 transition-colors flex items-center gap-1"
 >
 <ArrowLeft className="h-3.5 w-3.5" />
 Back to Queries
 </Link>
 <div className="text-center py-16 rounded-lg border border-dashed border-gray-200 dark:border-gray-700">
 <p className="text-gray-500 dark:text-gray-400 text-sm">{error || "Query not found"}</p>
 </div>
 </div>
 );
 }

 const isCreator = currentUserId === query.created_by;

 return (
 <div className="p-6 space-y-4 max-w-7xl">
 {/* Breadcrumb */}
 <div className="flex items-center gap-2">
 <Link
 href="/dashboard/studio/queries"
 className="text-sm text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 dark:text-blue-400 transition-colors flex items-center gap-1"
 >
 <ArrowLeft className="h-3.5 w-3.5" />
 Queries
 </Link>
 <span className="text-gray-300">/</span>
 <span className="text-sm text-gray-700 font-medium flex items-center gap-1.5">
 <Workflow className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
 {query.name}
 </span>
 </div>

 <QueryBuilder
 queryId={queryId}
 initialName={query.name}
 initialDescription={query.description ?? ""}
 initialDefinition={query.definition || EMPTY_DEFINITION}
 initialStatus={query.status}
 isCreator={isCreator}
 collections={collections}
 onSave={handleSave}
 />
 </div>
 );
}