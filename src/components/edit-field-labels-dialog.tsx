"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
 Dialog,
 DialogClose,
 DialogContent,
 DialogDescription,
 DialogFooter,
 DialogHeader,
 DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { updateFieldLabels } from "@/app/actions/studio";
import { SUPPORTED_LANGUAGES } from "@/lib/constants";

interface Props {
 open: boolean;
 onOpenChange: (open: boolean) => void;
 fieldId: string;
 fieldName: string;
 collectionSlug: string;
 existingLabels: Record<string, string>;
 onDeleteRequest?: () => void;
}

export function EditFieldLabelsDialog({
 open,
 onOpenChange,
 fieldId,
 fieldName,
 collectionSlug,
 existingLabels,
 onDeleteRequest,
}: Props) {
 const router = useRouter();
 const [loading, setLoading] = useState(false);
 const [labels, setLabels] = useState<Record<string, string>>({});

 // Non-default languages (English is the canonical name)
 const otherLanguages = SUPPORTED_LANGUAGES.filter((l) => l.code !== "en");

 useEffect(() => {
 if (open) {
 setLabels({ ...existingLabels });
 }
 }, [open, existingLabels]);

 async function handleSubmit(e: React.FormEvent) {
 e.preventDefault();
 setLoading(true);

 // Clean empty values
 const cleaned: Record<string, string> = {};
 for (const [code, value] of Object.entries(labels)) {
 const trimmed = value.trim();
 if (trimmed) cleaned[code] = trimmed;
 }

 const result = await updateFieldLabels(fieldId, collectionSlug, cleaned);
 setLoading(false);

 if (result.error) {
 toast.error(result.error);
 return;
 }

 toast.success("Field labels updated");
 onOpenChange(false);
 router.refresh();
 }

 return (
 <Dialog open={open} onOpenChange={onOpenChange}>
 <DialogContent className="bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 shadow-[0_0_40px_rgba(0,240,255,0.15)] sm:max-w-md">
 <form onSubmit={handleSubmit}>
 <DialogHeader>
 <DialogTitle
 className="text-blue-600 dark:text-blue-400"
 style={{ fontFamily: "var(--font-geist-sans), sans-serif" }}
 >
 Edit Field Labels
 </DialogTitle>
 <DialogDescription className="text-gray-500 dark:text-gray-400">
 Set translated names for this field. Empty values fall back to the default (English) name.
 </DialogDescription>
 </DialogHeader>

 <div className="mt-4 space-y-4">
 {/* English (canonical — read-only) */}
 <div className="space-y-1.5">
 <Label className="text-gray-500 dark:text-gray-400 text-xs">English (default)</Label>
 <Input
 value={fieldName}
 disabled
 className="bg-gray-100 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed"
 />
 </div>

 {/* Other languages */}
 {otherLanguages.map((lang) => (
 <div key={lang.code} className="space-y-1.5">
 <Label className="text-gray-900 dark:text-gray-100 text-xs">
 {lang.name}{" "}
 <span className="text-gray-500 dark:text-gray-400">({lang.code})</span>
 </Label>
 <Input
 placeholder={fieldName}
 value={labels[lang.code] ?? ""}
 onChange={(e) =>
 setLabels((prev) => ({ ...prev, [lang.code]: e.target.value }))
 }
 className="bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 placeholder:text-gray-500 dark:text-gray-400/30"
 />
 </div>
 ))}
 </div>

 <DialogFooter className="mt-6">
 <div className="flex w-full items-center justify-between">
 {onDeleteRequest ? (
 <Button type="button" variant="outline" size="sm" className="text-red-400 border-red-500/30 hover:bg-red-500/10 hover:text-red-300" onClick={onDeleteRequest}>
 Delete Field
 </Button>
 ) : <span />}
 <div className="flex gap-2">
 <DialogClose
 render={
 <Button
 type="button"
 variant="outline"
 className="border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-blue-600 dark:hover:text-blue-400 dark:text-blue-400"
 />
 }
 >
 Cancel
 </DialogClose>
 <Button
 type="submit"
 disabled={loading}
 className="bg-blue-50 dark:bg-blue-950 border border-blue-500/40 text-blue-600 dark:text-blue-400 hover:bg-blue-500/30 hover:text-[#a8c4ff]"
 >
 {loading ? "Saving..." : "Save Labels"}
 </Button>
 </div>
 </div>
 </DialogFooter>
 </form>
 </DialogContent>
 </Dialog>
 );
}