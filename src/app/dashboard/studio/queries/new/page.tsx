"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { QueryBuilder } from "@/components/query-builder";
import { EMPTY_DEFINITION } from "@/types/queries";
import { ArrowLeft, Workflow } from "lucide-react";
import Link from "next/link";
import type { QueryDefinition, QueryStatus } from "@/types/queries";

interface CollectionOption {
 id: string;
 slug: string;
 name: string;
 type: string;
 fields: { slug: string; name: string; field_type: string }[];
}

export default function NewQueryPage() {
 const router = useRouter();
 const [collections, setCollections] = useState<CollectionOption[]>([]);
 const [loading, setLoading] = useState(true);

 // Fetch available collections with their fields
 useEffect(() => {
 async function load() {
 try {
 const res = await fetch("/api/queries/collections");
 if (res.ok) {
 const json = await res.json();
 setCollections(json.data ?? []);
 }
 } finally {
 setLoading(false);
 }
 }
 load();
 }, []);

 const handleSave = async (data: {
 name: string;
 description: string;
 definition: QueryDefinition;
 status: QueryStatus;
 }) => {
 const res = await fetch("/api/queries", {
 method: "POST",
 headers: { "Content-Type": "application/json" },
 body: JSON.stringify({
 name: data.name,
 description: data.description,
 definition: data.definition,
 }),
 });

 const json = await res.json();
 if (!res.ok) throw new Error(json.error);

 // If publishing immediately, update status
 if (data.status === "published" && json.data?.id) {
 await fetch(`/api/queries/${json.data.id}`, {
 method: "PATCH",
 headers: { "Content-Type": "application/json" },
 body: JSON.stringify({ status: "published" }),
 });
 }

 // Redirect to the saved query
 router.push(`/dashboard/studio/queries/${json.data.id}`);
 };

 if (loading) {
 return (
 <div className="p-6 flex items-center justify-center min-h-[400px]">
 <div className="text-gray-400 dark:text-gray-500 text-sm">Loading collections...</div>
 </div>
 );
 }

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
 New Query
 </span>
 </div>

 <QueryBuilder
 initialName=""
 initialDescription=""
 initialDefinition={EMPTY_DEFINITION}
 initialStatus="draft"
 isCreator={true}
 collections={collections}
 onSave={handleSave}
 />
 </div>
 );
}