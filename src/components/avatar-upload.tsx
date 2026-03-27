"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Loader2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { uploadAvatar, uploadAvatarForUser } from "@/app/actions/storage";
import { toast } from "sonner";

interface AvatarUploadProps {
 initials: string;
 currentUrl?: string | null;
 size?: "sm" | "lg";
 /** When set, uploads avatar for this user ID (admin use) instead of current user */
 targetUserId?: string;
}

export function AvatarUpload({ initials, currentUrl, size = "sm", targetUserId }: AvatarUploadProps) {
 const router = useRouter();
 const inputRef = useRef<HTMLInputElement>(null);
 const [uploading, setUploading] = useState(false);
 const [previewUrl, setPreviewUrl] = useState<string | null>(currentUrl ?? null);

 const sizeClass = size === "lg" ? "h-16 w-16" : "h-8 w-8";
 const textClass = size === "lg" ? "text-lg font-bold" : "text-xs font-bold";

 async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
 const file = e.target.files?.[0];
 if (!file) return;

 // Quick local preview
 const local = URL.createObjectURL(file);
 setPreviewUrl(local);

 setUploading(true);
 const fd = new FormData();
 fd.set("file", file);
 let result: { url?: string; error?: string };
 if (targetUserId) {
 fd.set("targetUserId", targetUserId);
 result = await uploadAvatarForUser(fd);
 } else {
 result = await uploadAvatar(fd);
 }
 setUploading(false);

 if (result.error) {
 toast.error(result.error);
 setPreviewUrl(currentUrl ?? null);
 return;
 }

 if (result.url) setPreviewUrl(result.url);
 toast.success("Avatar updated");
 router.refresh();
 }

 return (
 <div className="relative inline-block group cursor-pointer" onClick={() => inputRef.current?.click()}>
 <Avatar className={`${sizeClass} bg-gradient-to-br from-blue-500 to-indigo-500`}>
 {previewUrl && <AvatarImage src={previewUrl} alt="Avatar" />}
 <AvatarFallback className={`${textClass} text-white`}>{initials}</AvatarFallback>
 </Avatar>

 {/* Hover overlay */}
 <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
 {uploading ? (
 <Loader2 className="h-3.5 w-3.5 text-white animate-spin" />
 ) : (
 <Camera className="h-3.5 w-3.5 text-white" />
 )}
 </div>

 <input
 ref={inputRef}
 type="file"
 accept="image/png,image/jpeg,image/webp,image/gif"
 onChange={handleFile}
 className="hidden"
 />
 </div>
 );
}