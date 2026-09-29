"use client";

import { useState, useTransition } from "react";

import type { ActionResult } from "@/lib/actions/types";
import { useConfirm, useNotify } from "@/components/ui/dialogs";

/**
 * Suppression avec confirmation. L'action serveur redirige en cas de succès ; en cas de
 * refus (ressource encore utilisée…), son message est affiché sous le bouton.
 */
export function DeleteButton({
  id,
  label,
  confirmMessage,
  action,
}: {
  id: string;
  label: string;
  confirmMessage: string;
  action: (input: { id: string }) => Promise<ActionResult>;
}) {
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const confirm = useConfirm();
  const notify = useNotify();

  async function onClick() {
    const ok = await confirm({
      title: `${label} ?`,
      message: confirmMessage,
      confirmLabel: label,
      cancelLabel: "Retour",
      tone: "danger",
      icon: "trash",
    });
    if (!ok) return;
    setError(undefined);
    startTransition(async () => {
      const result = await action({ id });
      // Succès sans redirection (suppression depuis une liste) : notification.
      if (!result.error && result.success) notify(result.success);
      setError(result.error);
    });
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        className="rounded-full border border-red-700 px-5 py-2.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
      >
        {pending ? "Suppression…" : label}
      </button>
      {error ? (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
