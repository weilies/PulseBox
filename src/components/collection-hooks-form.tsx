"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateCollectionHooks } from "@/app/actions/webhooks";
import { toast } from "sonner";
import { Pencil, X, Check } from "lucide-react";

interface CollectionHooksFormProps {
  collectionSlug: string;
  canEdit: boolean;
  preSaveUrl: string;
  preSaveTimeoutMs: number;
  preSaveSecret: string;
  preSaveFailStrict: boolean;
}

export function CollectionHooksForm({
  collectionSlug,
  canEdit,
  preSaveUrl,
  preSaveTimeoutMs,
  preSaveSecret,
  preSaveFailStrict,
}: CollectionHooksFormProps) {
  const [editing, setEditing] = useState(false);
  const [url, setUrl] = useState(preSaveUrl);
  const [timeoutMs, setTimeoutMs] = useState(preSaveTimeoutMs);
  const [secret, setSecret] = useState(preSaveSecret);
  const [failStrict, setFailStrict] = useState(preSaveFailStrict);
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    startTransition(async () => {
      try {
        const hooks: Record<string, unknown> = {};
        if (url.trim()) {
          hooks.on_pre_save = {
            url: url.trim(),
            timeout_ms: timeoutMs,
            ...(secret.trim() ? { secret: secret.trim() } : {}),
            fail_strict: failStrict,
          };
        }
        await updateCollectionHooks(collectionSlug, hooks);
        toast.success("Collection hooks updated");
        setEditing(false);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to save");
      }
    });
  }

  const hasHook = !!preSaveUrl;

  if (!editing) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white px-4 py-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          {hasHook ? (
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-gray-700">onPreSave</span>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-xs text-emerald-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Active
                </span>
                {preSaveFailStrict && (
                  <span className="rounded bg-red-50 border border-red-200 px-1.5 py-0.5 text-xs text-red-600">
                    fail-strict
                  </span>
                )}
              </div>
              <code className="text-xs text-gray-400 font-mono truncate block">{preSaveUrl}</code>
              <span className="text-xs text-gray-400">Timeout: {preSaveTimeoutMs}ms</span>
            </div>
          ) : (
            <p className="text-sm text-gray-400 italic">No onPreSave hook configured.</p>
          )}
        </div>
        {canEdit && (
          <Button
            variant="ghost"
            size="sm"
            className="text-gray-500 gap-1.5 shrink-0"
            onClick={() => setEditing(true)}
          >
            <Pencil className="h-3.5 w-3.5" />
            {hasHook ? "Edit" : "Configure"}
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50/30 p-4 space-y-3">
      <div className="space-y-1.5">
        <Label className="text-xs text-gray-600">Endpoint URL</Label>
        <Input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://your-server.com/hooks/pre-save"
          className="border-gray-200 bg-white text-gray-900 text-sm font-mono"
        />
        <p className="text-xs text-gray-400">Leave blank to remove the hook.</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-gray-600">Timeout (ms)</Label>
          <Input
            type="number"
            value={timeoutMs}
            onChange={(e) => setTimeoutMs(Number(e.target.value))}
            min={500}
            max={30000}
            className="border-gray-200 bg-white text-gray-900 text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-gray-600">Signing Secret <span className="text-gray-400 font-normal">(optional)</span></Label>
          <Input
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            placeholder="hmac-secret"
            className="border-gray-200 bg-white text-gray-900 text-sm font-mono"
          />
        </div>
      </div>

      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={failStrict}
          onChange={(e) => setFailStrict(e.target.checked)}
          className="accent-red-500"
        />
        <span className="text-xs text-gray-600">
          <strong>Fail strict</strong> — block save if hook is unreachable (default: fail-open)
        </span>
      </label>

      <div className="flex gap-2">
        <Button
          size="sm"
          onClick={handleSave}
          disabled={isPending}
          className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5"
        >
          <Check className="h-3.5 w-3.5" />
          {isPending ? "Saving…" : "Save"}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setUrl(preSaveUrl);
            setTimeoutMs(preSaveTimeoutMs);
            setSecret(preSaveSecret);
            setFailStrict(preSaveFailStrict);
            setEditing(false);
          }}
          className="text-gray-500 gap-1.5"
        >
          <X className="h-3.5 w-3.5" />
          Cancel
        </Button>
      </div>
    </div>
  );
}
