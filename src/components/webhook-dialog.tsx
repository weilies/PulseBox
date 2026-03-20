"use client";

import { useState, useRef, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import { createWebhook, updateWebhook } from "@/app/actions/webhooks";
import { toast } from "sonner";

const ALL_EVENTS = [
  { value: "item.created", label: "item.created", desc: "Item inserted" },
  { value: "item.updated", label: "item.updated", desc: "Item updated" },
  { value: "item.deleted", label: "item.deleted", desc: "Item deleted" },
];

type Webhook = {
  id: string;
  name: string;
  url: string;
  secret: string | null;
  events: string[];
  is_active: boolean;
};

interface WebhookDialogProps {
  collectionSlug: string;
  webhook?: Webhook;
  children?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function WebhookDialog({
  collectionSlug,
  webhook,
  children,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: WebhookDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = controlledOnOpenChange ?? setInternalOpen;
  const [events, setEvents] = useState<string[]>(webhook?.events ?? []);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  const isEdit = !!webhook;

  function toggleEvent(value: string) {
    setEvents((prev) =>
      prev.includes(value) ? prev.filter((e) => e !== value) : [...prev, value]
    );
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    // Remove browser-appended events, re-add from state
    events.forEach((ev) => fd.append("events", ev));
    fd.set("collection_slug", collectionSlug);

    startTransition(async () => {
      try {
        if (isEdit) {
          fd.set("is_active", webhook.is_active ? "true" : "false");
          await updateWebhook(webhook.id, fd);
        } else {
          await createWebhook(fd);
        }
        toast.success(isEdit ? "Webhook updated" : "Webhook created");
        setOpen(false);
        formRef.current?.reset();
        if (!isEdit) setEvents([]);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to save webhook");
      }
    });
  }

  const isControlled = controlledOpen !== undefined;
  const trigger = children ?? (
    <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5">
      <Plus className="h-3.5 w-3.5" />
      Add Webhook
    </Button>
  );

  return (
    <>
      {!isControlled && (
        <div onClick={() => setOpen(true)} className="contents">{trigger}</div>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md bg-white border-gray-200">
        <DialogHeader>
          <DialogTitle className="text-gray-900" style={{ fontFamily: "var(--font-geist-sans), sans-serif" }}>
            {isEdit ? "Edit Webhook" : "Add Webhook"}
          </DialogTitle>
        </DialogHeader>

        <form ref={formRef} onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label className="text-xs text-gray-600">Name</Label>
            <Input
              name="name"
              defaultValue={webhook?.name}
              placeholder="Slack notification"
              required
              className="border-gray-200 text-gray-900 bg-white text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-gray-600">Endpoint URL</Label>
            <Input
              name="url"
              type="url"
              defaultValue={webhook?.url}
              placeholder="https://your-server.com/webhook"
              required
              className="border-gray-200 text-gray-900 bg-white text-sm font-mono"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-gray-600">
              Signing Secret <span className="text-gray-400 font-normal">(optional)</span>
            </Label>
            <Input
              name="secret"
              defaultValue={webhook?.secret ?? ""}
              placeholder="Leave blank to skip signature"
              className="border-gray-200 text-gray-900 bg-white text-sm font-mono"
            />
            <p className="text-xs text-gray-400">
              If set, each request includes <code className="text-blue-600">X-PulseBoard-Signature: sha256=…</code>
            </p>
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-gray-600">Events</Label>
            <div className="space-y-2">
              {ALL_EVENTS.map((ev) => (
                <label
                  key={ev.value}
                  className="flex items-center gap-3 cursor-pointer rounded-md border border-gray-200 px-3 py-2 hover:bg-gray-50"
                >
                  <input
                    type="checkbox"
                    checked={events.includes(ev.value)}
                    onChange={() => toggleEvent(ev.value)}
                    className="accent-blue-600"
                  />
                  <div>
                    <code className="text-xs text-blue-600 font-mono">{ev.label}</code>
                    <span className="ml-2 text-xs text-gray-400">{ev.desc}</span>
                  </div>
                </label>
              ))}
            </div>
            {events.length === 0 && (
              <p className="text-xs text-amber-600">Select at least one event to receive deliveries.</p>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setOpen(false)}
              className="text-gray-500"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isPending || events.length === 0}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {isPending ? "Saving…" : isEdit ? "Save Changes" : "Create Webhook"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
    </>
  );
}
