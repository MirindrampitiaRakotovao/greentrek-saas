"use client";

import { useState, useTransition } from "react";

import type { ActionResult } from "@/lib/actions/types";

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

  function onClick() {
    if (!window.confirm(confirmMessage)) return;
    setError(undefined);
    startTransition(async () => {
      const result = await action({ id });
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
