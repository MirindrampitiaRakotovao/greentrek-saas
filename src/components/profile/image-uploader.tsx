"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";

import { Avatar } from "@/components/ui/avatar";
import { useNotify } from "@/components/ui/dialogs";
import { FormAlert } from "@/components/ui/form-alert";
import type { ActionResult } from "@/lib/actions/types";
import {
  removeMyPhotoAction,
  uploadAgencyLogoAction,
  uploadMyPhotoAction,
} from "@/lib/actions/photos";

const MAX = 5 * 1024 * 1024;

/**
 * Envoi d'une image : photo de profil (ronde) ou logo de l'agence (carré). Aperçu, contrôle
 * de la taille côté navigateur (le serveur revérifie tout), puis enregistrement.
 */
export function ImageUploader({
  kind,
  name,
  current,
}: {
  kind: "photo" | "logo";
  name: string;
  current: string | null;
}) {
  const router = useRouter();
  const notify = useNotify();
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const shown = preview ?? current;

  function done(result: ActionResult) {
    if (result.error) {
      setError(result.error);
      setPreview(null);
      return;
    }
    if (result.success) notify(result.success);
    router.refresh();
  }

  function onFile(file: File | undefined) {
    setError(undefined);
    if (!file) return;
    if (!file.type.startsWith("image/")) return setError("Choisissez une image (JPEG, PNG, WebP).");
    if (file.size > MAX) return setError("Image trop lourde (5 Mo au plus).");
    setPreview(URL.createObjectURL(file));
    const data = new FormData();
    data.set(kind, file);
    startTransition(async () => {
      done(kind === "logo" ? await uploadAgencyLogoAction(data) : await uploadMyPhotoAction(data));
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-5">
      {kind === "logo" ? (
        shown ? (
          // eslint-disable-next-line @next/next/no-img-element -- image envoyée, déjà réduite
          <img
            src={shown}
            alt={`Logo de ${name}`}
            className="size-24 rounded-2xl bg-white object-contain p-2 ring-1 ring-gt-mist"
          />
        ) : (
          <span className="grid size-24 place-items-center rounded-2xl bg-gt-teal-50 text-xs text-gt-teal-900/75 ring-1 ring-gt-mist">
            Aucun logo
          </span>
        )
      ) : (
        <Avatar name={name} src={shown} size={96} label={`Photo de profil de ${name}`} />
      )}
      <div className="space-y-2">
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          id={`envoi-${kind}`}
          onChange={(e) => onFile(e.target.files?.[0])}
        />
        <div className="flex flex-wrap gap-2">
          <label
            htmlFor={`envoi-${kind}`}
            className="cursor-pointer rounded-full bg-gt-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-gt-teal-800"
          >
            {pending
              ? "Envoi…"
              : current
                ? "Changer"
                : kind === "logo"
                  ? "Ajouter un logo"
                  : "Ajouter une photo"}
          </label>
          {kind === "photo" && current && !pending ? (
            <button
              type="button"
              onClick={() => startTransition(async () => done(await removeMyPhotoAction()))}
              className="rounded-full border border-gt-mist px-4 py-2 text-sm font-medium text-gt-teal-900 hover:bg-gt-teal-50"
            >
              Retirer
            </button>
          ) : null}
        </div>
        <p className="text-xs text-gt-teal-900/75">
          JPEG, PNG ou WebP, 5 Mo au plus. Les informations cachées de la photo (position GPS,
          appareil) sont retirées.
        </p>
        <FormAlert message={error} />
      </div>
    </div>
  );
}
