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
}

export function EditFieldLabelsDialog({
  open,
  onOpenChange,
  fieldId,
  fieldName,
  collectionSlug,
  existingLabels,
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
      <DialogContent className="bg-white border border-gray-300 text-gray-900 shadow-[0_0_40px_rgba(0,240,255,0.15)] sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle
              className="text-blue-600"
              style={{ fontFamily: "var(--font-geist-sans), sans-serif" }}
            >
              Edit Field Labels
            </DialogTitle>
            <DialogDescription className="text-gray-500">
              Set translated names for this field. Empty values fall back to the default (English) name.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-4">
            {/* English (canonical — read-only) */}
            <div className="space-y-1.5">
              <Label className="text-gray-500 text-xs">English (default)</Label>
              <Input
                value={fieldName}
                disabled
                className="bg-gray-100/50 border-gray-200 text-gray-500 cursor-not-allowed"
              />
            </div>

            {/* Other languages */}
            {otherLanguages.map((lang) => (
              <div key={lang.code} className="space-y-1.5">
                <Label className="text-gray-900 text-xs">
                  {lang.name}{" "}
                  <span className="text-gray-500">({lang.code})</span>
                </Label>
                <Input
                  placeholder={fieldName}
                  value={labels[lang.code] ?? ""}
                  onChange={(e) =>
                    setLabels((prev) => ({ ...prev, [lang.code]: e.target.value }))
                  }
                  className="bg-gray-100 border-gray-300 text-gray-900 placeholder:text-gray-500/30"
                />
              </div>
            ))}
          </div>

          <DialogFooter className="mt-6">
            <DialogClose
              render={
                <Button
                  type="button"
                  variant="outline"
                  className="border-gray-300 text-gray-500 hover:bg-gray-100 hover:text-blue-600"
                />
              }
            >
              Cancel
            </DialogClose>
            <Button
              type="submit"
              disabled={loading}
              className="bg-blue-50 border border-blue-500/40 text-blue-600 hover:bg-blue-500/30 hover:text-[#a8c4ff]"
            >
              {loading ? "Saving..." : "Save Labels"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
