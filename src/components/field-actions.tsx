"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { MoreHorizontal, Trash2, ChevronUp, ChevronDown, Globe } from "lucide-react";
import { toast } from "sonner";
import { deleteField, moveField } from "@/app/actions/studio";
import { EditFieldLabelsDialog } from "@/components/edit-field-labels-dialog";

interface Props {
  fieldId: string;
  fieldName: string;
  fieldOptions: Record<string, unknown>;
  sortOrder: number;
  collectionId: string;
  collectionSlug: string;
  isFirst: boolean;
  isLast: boolean;
}

export function FieldActions({
  fieldId,
  fieldName,
  fieldOptions,
  sortOrder,
  collectionId,
  collectionSlug,
  isFirst,
  isLast,
}: Props) {
  const router = useRouter();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [labelsOpen, setLabelsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const existingLabels = (fieldOptions?.labels as Record<string, string>) ?? {};

  async function handleMove(direction: "up" | "down") {
    const formData = new FormData();
    formData.set("field_id", fieldId);
    formData.set("direction", direction);
    formData.set("sort_order", String(sortOrder));
    formData.set("collection_id", collectionId);
    formData.set("collection_slug", collectionSlug);
    await moveField(formData);
    router.refresh();
  }

  async function handleDelete() {
    setLoading(true);
    const formData = new FormData();
    formData.set("field_id", fieldId);
    formData.set("collection_slug", collectionSlug);
    const result = await deleteField(formData);
    setLoading(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success(`Field "${fieldName}" deleted`);
    setDeleteOpen(false);
    router.refresh();
  }

  return (
    <>
      <div className="flex items-center gap-0.5 flex-shrink-0">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 text-zinc-600 hover:text-zinc-300 disabled:opacity-20"
          disabled={isFirst}
          onClick={() => handleMove("up")}
          title="Move up"
        >
          <ChevronUp className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 text-zinc-600 hover:text-zinc-300 disabled:opacity-20"
          disabled={isLast}
          onClick={() => handleMove("down")}
          title="Move down"
        >
          <ChevronDown className="h-3.5 w-3.5" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-zinc-500 hover:text-zinc-300"
              />
            }
          >
            <MoreHorizontal className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="bg-white border-gray-300 text-gray-900"
          >
            <DropdownMenuItem
              className="gap-2 cursor-pointer text-gray-500 hover:bg-gray-100 hover:text-blue-600"
              onClick={() => setLabelsOpen(true)}
            >
              <Globe className="h-3.5 w-3.5" />
              Edit Labels
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-blue-50" />
            <DropdownMenuItem
              className="gap-2 cursor-pointer text-red-400 hover:bg-red-50 hover:text-red-300"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete Field
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Edit Labels */}
      <EditFieldLabelsDialog
        open={labelsOpen}
        onOpenChange={setLabelsOpen}
        fieldId={fieldId}
        fieldName={fieldName}
        collectionSlug={collectionSlug}
        existingLabels={existingLabels}
      />

      {/* Delete confirm */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="bg-white border border-red-500/30 text-gray-900">
          <DialogHeader>
            <DialogTitle className="text-red-400">Delete Field</DialogTitle>
            <DialogDescription className="text-gray-500">
              Delete <strong className="text-white">{fieldName}</strong>?{" "}
              All item data stored in this field will be lost. If this is an M2M relation,
              the junction collection will also be deleted.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <DialogClose
              render={
                <Button
                  type="button"
                  variant="outline"
                  className="border-zinc-600 text-gray-500 hover:bg-zinc-700"
                />
              }
            >
              Cancel
            </DialogClose>
            <Button
              onClick={handleDelete}
              disabled={loading}
              className="bg-red-500/20 border border-red-500/40 text-red-400 hover:bg-red-500/30"
            >
              {loading ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
