"use client";

import { useState, useTransition } from "react";

import type { ActionResult } from "@/lib/actions/types";
import { useConfirm } from "@/components/ui/dialogs";

const VARIANTS = {
  primary: "bg-gt-teal-700 text-white hover:bg-gt-teal-800",
  secondary: "border border-gt-teal-700 text-gt-teal-700 hover:bg-gt-teal-50",
  danger: "border border-red-700 text-red-700 hover:bg-red-50",
} as const;

/**
 * Bouton qui déclenche une action serveur sur un identifiant (confirmer, annuler, valider un
 * paiement…), avec confirmation facultative et message de résultat sous le bouton.
 */
export function ActionButton({
  id,
  label,
  pendingLabel,
  action,
  confirmMessage,
  confirmTitle,
  variant = "primary",
  size = "md",
}: {
  id: string;
  label: string;
  pendingLabel?: string;
  action: (input: { id: string }) => Promise<ActionResult>;
  confirmMessage?: string;
  /** Titre de la modale de confirmation (par défaut : le libellé du bouton). */
  confirmTitle?: string;
  variant?: keyof typeof VARIANTS;
  size?: "sm" | "md";
}) {
  const [result, setResult] = useState<ActionResult>();
  const [pending, startTransition] = useTransition();
  const confirm = useConfirm();

  async function onClick() {
    if (
      confirmMessage &&
      !(await confirm({
        title: confirmTitle ?? `${label} ?`,
        message: confirmMessage,
        confirmLabel: label,
        cancelLabel: "Retour",
        tone: variant === "danger" ? "danger" : "default",
      }))
    ) {
      return;
    }
    setResult(undefined);
    startTransition(async () => setResult(await action({ id })));
  }

  return (
    <span className="inline-flex flex-col gap-1">
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        className={`rounded-full font-medium disabled:opacity-60 ${VARIANTS[variant]} ${
          size === "sm" ? "px-3 py-1 text-xs" : "px-5 py-2.5 text-sm"
        }`}
      >
        {pending ? (pendingLabel ?? "…") : label}
      </button>
      {result?.error ? (
        <span role="alert" className="text-xs text-red-700">
          {result.error}
        </span>
      ) : null}
      {result?.success ? (
        <span role="status" className="text-xs text-emerald-800">
          {result.success}
        </span>
      ) : null}
    </span>
  );
}
