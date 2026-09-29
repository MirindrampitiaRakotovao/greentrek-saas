"use client";

import { useState, useTransition } from "react";

import { setMemberActiveAction } from "@/lib/actions/team";
import { useConfirm } from "@/components/ui/dialogs";

/**
 * Active ou désactive un compte. Une confirmation est demandée avant de désactiver
 * (le membre perd immédiatement l'accès, RG 19).
 */
export function ToggleActiveButton({
  id,
  actif,
  name,
}: {
  id: string;
  actif: boolean;
  name: string;
}) {
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const confirm = useConfirm();

  async function onClick() {
    if (
      actif &&
      !(await confirm({
        title: "Désactiver ce compte ?",
        message: `${name} perdra l'accès immédiatement. Vous pourrez le réactiver plus tard.`,
        confirmLabel: "Désactiver",
        cancelLabel: "Retour",
        tone: "danger",
      }))
    ) {
      return;
    }
    setError(undefined);
    startTransition(async () => {
      const result = await setMemberActiveAction({ id, actif: !actif });
      setError(result.error);
    });
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        className="text-sm font-medium text-gt-teal-700 underline hover:text-gt-teal-900 disabled:opacity-60"
      >
        {pending ? "…" : actif ? "Désactiver" : "Réactiver"}
      </button>
      {error ? (
        <span role="alert" className="text-xs text-red-700">
          {error}
        </span>
      ) : null}
    </span>
  );
}
