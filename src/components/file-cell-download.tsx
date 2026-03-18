"use client";

import { useState } from "react";
import { Paperclip, Loader2 } from "lucide-react";
import { getSignedFileUrl } from "@/app/actions/storage";
import { toast } from "sonner";

interface FileCellDownloadProps {
  path: string;
}

export function FileCellDownload({ path }: FileCellDownloadProps) {
  const [loading, setLoading] = useState(false);

  // Extract display filename from the storage path
  const parts = path.split("/");
  const filename = parts[parts.length - 1] || path;

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

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-700 hover:underline transition-colors disabled:opacity-60 max-w-[140px]"
      title={`View / download: ${filename}`}
    >
      {loading ? (
        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
      ) : (
        <Paperclip className="h-3.5 w-3.5 shrink-0" />
      )}
      <span className="text-xs truncate">{filename}</span>
    </button>
  );
}
