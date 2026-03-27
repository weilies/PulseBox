"use client";

import { useState, useEffect } from "react";
import { Loader2, FileText, FileSpreadsheet, FileImage, FileArchive, File } from "lucide-react";
import { getSignedFileUrl } from "@/app/actions/storage";
import { toast } from "sonner";

const IMAGE_EXTS = new Set(["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "ico"]);

const EXT_ICON_MAP: Record<string, { icon: typeof FileText; color: string }> = {
 pdf: { icon: FileText, color: "text-red-500" },
 doc: { icon: FileText, color: "text-blue-500" },
 docx: { icon: FileText, color: "text-blue-500" },
 xls: { icon: FileSpreadsheet, color: "text-green-600" },
 xlsx: { icon: FileSpreadsheet, color: "text-green-600" },
 csv: { icon: FileSpreadsheet, color: "text-green-600" },
 ppt: { icon: FileText, color: "text-orange-500" },
 pptx: { icon: FileText, color: "text-orange-500" },
 zip: { icon: FileArchive, color: "text-yellow-500" },
 rar: { icon: FileArchive, color: "text-yellow-500" },
 "7z": { icon: FileArchive, color: "text-yellow-500" },
 tar: { icon: FileArchive, color: "text-yellow-500" },
 gz: { icon: FileArchive, color: "text-yellow-500" },
 png: { icon: FileImage, color: "text-purple-500" },
 jpg: { icon: FileImage, color: "text-purple-500" },
 jpeg: { icon: FileImage, color: "text-purple-500" },
 gif: { icon: FileImage, color: "text-purple-500" },
 webp: { icon: FileImage, color: "text-purple-500" },
 svg: { icon: FileImage, color: "text-purple-500" },
};

function getExtension(filename: string): string {
 const dot = filename.lastIndexOf(".");
 return dot >= 0 ? filename.slice(dot + 1).toLowerCase() : "";
}

interface FileCellDownloadProps {
 path: string;
}

export function FileCellDownload({ path }: FileCellDownloadProps) {
 const [loading, setLoading] = useState(false);
 const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);

 // Extract display filename from the storage path
 const parts = path.split("/");
 const filename = parts[parts.length - 1] || path;
 const ext = getExtension(filename);
 const isImage = IMAGE_EXTS.has(ext);

 // For images, eagerly fetch a signed URL for thumbnail
 useEffect(() => {
 if (!isImage) return;
 let cancelled = false;
 getSignedFileUrl(path).then(({ url }) => {
 if (!cancelled && url) setThumbnailUrl(url);
 });
 return () => { cancelled = true; };
 }, [path, isImage]);

 async function handleClick() {
 setLoading(true);
 const { url, error } = await getSignedFileUrl(path);
 setLoading(false);
 if (error || !url) {
 toast.error("Could not generate download link");
 return;
 }
 window.open(url, "_blank", "noopener,noreferrer");
 }

 // Image thumbnail
 if (isImage) {
 return (
 <button
 onClick={handleClick}
 disabled={loading}
 className="inline-flex items-center gap-2 hover:opacity-80 transition-opacity disabled:opacity-60"
 title={`View: ${filename}`}
 >
 {loading && <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-blue-400" />}
 {thumbnailUrl ? (
 // eslint-disable-next-line @next/next/no-img-element
 <img
 src={thumbnailUrl}
 alt={filename}
 className="h-8 w-8 rounded object-cover border border-gray-200 dark:border-gray-700"
 />
 ) : (
 <div className="h-8 w-8 rounded bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex items-center justify-center">
 <FileImage className="h-4 w-4 text-purple-500" />
 </div>
 )}
 </button>
 );
 }

 // Non-image: show file-type icon only (no filename string)
 const iconInfo = EXT_ICON_MAP[ext] ?? { icon: File, color: "text-gray-400" };
 const IconComponent = iconInfo.icon;

 return (
 <button
 onClick={handleClick}
 disabled={loading}
 className="inline-flex items-center justify-center h-8 w-8 rounded border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-60"
 title={`View / download: ${filename}`}
 >
 {loading ? (
 <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
 ) : (
 <IconComponent className={`h-4 w-4 ${iconInfo.color}`} />
 )}
 </button>
 );
}
