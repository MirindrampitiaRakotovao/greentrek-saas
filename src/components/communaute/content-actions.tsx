"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import { useConfirm, useNotify } from "@/components/ui/dialogs";
import { Icon } from "@/components/ui/icon";
import {
  deleteCommentaireAction,
  deletePublicationAction,
  reportContentAction,
} from "@/lib/actions/communaute";

type Props = {
  cible: "PUBLICATION" | "COMMENTAIRE";
  id: string;
  deMoi: boolean;
  /** Adresse où aller après la suppression (sinon, `onDeleted` ou rafraîchissement). */
  afterDelete?: string;
  onDeleted?: () => void;
};

/** Supprimer (son contenu) ou signaler (celui d'un autre) : logique commune. */
function useContentActions({ cible, id, afterDelete, onDeleted }: Props) {
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
      if (result.error) return;
      if (afterDelete) router.push(afterDelete);
      else if (onDeleted) onDeleted();
      else router.refresh();
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

  return { remove, report, pending };
}

/** Commentaire : un seul bouton discret, « Supprimer » ou « Signaler ». */
export function ContentActions(props: Props) {
  const { remove, report, pending } = useContentActions(props);
  return (
    <button
      type="button"
      onClick={() => void (props.deMoi ? remove() : report())}
      disabled={pending}
      className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium text-gt-teal-900/75 hover:bg-gt-teal-50 ${
        props.deMoi ? "hover:text-red-700" : ""
      }`}
    >
      <Icon name={props.deMoi ? "trash" : "flag"} className="size-4" />
      {props.deMoi ? "Supprimer" : "Signaler"}
    </button>
  );
}

/** Publication : menu « … » (Supprimer pour son auteur, Signaler pour les autres). */
export function PostMenu(props: Props) {
  const { remove, report, pending } = useContentActions(props);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (
        e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)
      )
        setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Actions sur la publication"
        disabled={pending}
        className="flex size-9 items-center justify-center rounded-full text-gt-teal-900/75 hover:bg-gt-teal-50"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="currentColor">
          <circle cx="5" cy="12" r="1.8" />
          <circle cx="12" cy="12" r="1.8" />
          <circle cx="19" cy="12" r="1.8" />
        </svg>
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute top-10 right-0 z-10 min-w-40 rounded-2xl bg-white p-1 shadow-lg ring-1 ring-gt-mist"
        >
          <button
            type="button"
            role="menuitem"
            autoFocus
            onClick={() => {
              setOpen(false);
              void (props.deMoi ? remove() : report());
            }}
            className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm hover:bg-gt-teal-50 ${
              props.deMoi ? "text-red-700" : "text-gt-teal-900"
            }`}
          >
            <Icon name={props.deMoi ? "trash" : "flag"} className="size-4" />
            {props.deMoi ? "Supprimer" : "Signaler"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
