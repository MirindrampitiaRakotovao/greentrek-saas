"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { useConfirm, useNotify } from "@/components/ui/dialogs";
import { Icon } from "@/components/ui/icon";
import {
  deleteCommentaireAction,
  deletePublicationAction,
  reportContentAction,
} from "@/lib/actions/communaute";

/**
 * Sur une publication ou un commentaire : « Supprimer » pour son auteur, « Signaler » pour
 * les autres (le signalement part à l'équipe de la plateforme).
 */
export function ContentActions({
  cible,
  id,
  deMoi,
  afterDelete,
}: {
  cible: "PUBLICATION" | "COMMENTAIRE";
  id: string;
  deMoi: boolean;
  /** Adresse où aller après la suppression (sinon, la page est rafraîchie). */
  afterDelete?: string;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const notify = useNotify();
  const [pending, startTransition] = useTransition();
  const quoi = cible === "PUBLICATION" ? "cette publication" : "ce commentaire";

  async function remove() {
    const ok = await confirm({
      title: cible === "PUBLICATION" ? "Supprimer la publication ?" : "Supprimer le commentaire ?",
      message: `${quoi.charAt(0).toUpperCase()}${quoi.slice(1)} disparaîtra pour tout le monde.`,
      confirmLabel: "Supprimer",
      tone: "danger",
      icon: "trash",
    });
    if (!ok) return;
    startTransition(async () => {
      const result =
        cible === "PUBLICATION"
          ? await deletePublicationAction({ id })
          : await deleteCommentaireAction({ id });
      notify(result.error ?? result.success ?? "", result.error ? "error" : "success");
      if (!result.error) {
        if (afterDelete) router.push(afterDelete);
        else router.refresh();
      }
    });
  }

  async function report() {
    const ok = await confirm({
      title: "Signaler ce contenu ?",
      message: `L'équipe de la plateforme examinera ${quoi} et pourra le masquer.`,
      confirmLabel: "Signaler",
      icon: "flag",
    });
    if (!ok) return;
    startTransition(async () => {
      const result = await reportContentAction({ cible, cibleId: id, motif: null });
      notify(result.error ?? result.success ?? "", result.error ? "error" : "success");
    });
  }

  return deMoi ? (
    <button
      type="button"
      onClick={() => void remove()}
      disabled={pending}
      className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium text-gt-teal-900/75 hover:bg-gt-teal-50 hover:text-red-700"
    >
      <Icon name="trash" className="size-4" />
      Supprimer
    </button>
  ) : (
    <button
      type="button"
      onClick={() => void report()}
      disabled={pending}
      className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium text-gt-teal-900/75 hover:bg-gt-teal-50"
    >
      <Icon name="flag" className="size-4" />
      Signaler
    </button>
  );
}
