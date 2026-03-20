"use client";

import { useState, useTransition } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { MoreHorizontal, Pencil, Trash2, Send } from "lucide-react";
import { deleteWebhook, testWebhook } from "@/app/actions/webhooks";
import { WebhookDialog } from "@/components/webhook-dialog";
import { toast } from "sonner";

type Webhook = {
  id: string;
  name: string;
  url: string;
  secret: string | null;
  events: string[];
  is_active: boolean;
};

export function WebhookActions({
  webhook,
  collectionSlug,
}: {
  webhook: Webhook;
  collectionSlug: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [editOpen, setEditOpen] = useState(false);

  function handleDelete() {
    if (!confirm(`Delete webhook "${webhook.name}"? This cannot be undone.`)) return;
    startTransition(async () => {
      try {
        await deleteWebhook(webhook.id, collectionSlug);
        toast.success("Webhook deleted");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to delete");
      }
    });
  }

  function handleTest() {
    startTransition(async () => {
      try {
        await testWebhook(webhook.id);
        toast.success("Test delivery sent — check the logs below");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Test failed");
      }
    });
  }

  return (
    <>
      {/* Edit dialog — controlled via editOpen state */}
      <WebhookDialog
        collectionSlug={collectionSlug}
        webhook={webhook}
        open={editOpen}
        onOpenChange={setEditOpen}
      >
        {/* No children — dialog is controlled externally */}
        <span />
      </WebhookDialog>

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-gray-400 hover:text-gray-700"
              disabled={isPending}
            />
          }
        >
          <MoreHorizontal className="h-4 w-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40 bg-white border-gray-200">
          <DropdownMenuItem
            className="text-gray-700 cursor-pointer gap-2"
            onClick={() => setEditOpen(true)}
          >
            <Pencil className="h-3.5 w-3.5" /> Edit
          </DropdownMenuItem>
          <DropdownMenuItem
            className="text-blue-600 cursor-pointer gap-2"
            onClick={handleTest}
          >
            <Send className="h-3.5 w-3.5" /> Send Test
          </DropdownMenuItem>
          <DropdownMenuSeparator className="bg-gray-100" />
          <DropdownMenuItem
            className="text-red-500 cursor-pointer gap-2"
            onClick={handleDelete}
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
