"use client";

import { useRouter } from "next/navigation";

import { useConfirm, useNotify } from "@/components/ui/dialogs";
import { blockUserAction, unblockUserAction } from "@/lib/actions/voyageurs";

/** Bloquer (ou débloquer) un voyageur : plus aucun message dans les deux sens. */
export function BlockButton({
  id,
  nom,
  bloque = false,
}: {
  id: string;
  nom: string;
  bloque?: boolean;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const notify = useNotify();
  async function run() {
    if (!bloque) {
      const ok = await confirm({
        title: `Bloquer ${nom} ?`,
        message:
          "Vous ne recevrez plus ses messages et il ne pourra plus vous écrire. Vous pourrez le débloquer depuis la page « Voyageurs ».",
        confirmLabel: "Bloquer",
        cancelLabel: "Annuler",
        tone: "danger",
      });
      if (!ok) return;
    }
    const result = bloque ? await unblockUserAction({ id }) : await blockUserAction({ id });
    notify(result.error ?? result.success ?? "", result.error ? "error" : "success");
    router.refresh();
  }
  return (
    <button
      type="button"
      onClick={() => void run()}
      className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
        bloque
          ? "border-gt-mist text-gt-teal-900 hover:bg-gt-teal-50"
          : "border-red-200 text-red-700 hover:bg-red-50"
      }`}
    >
      {bloque ? "Débloquer" : "Bloquer"}
    </button>
  );
}
