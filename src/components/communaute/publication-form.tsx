"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { useNotify } from "@/components/ui/dialogs";
import { FormAlert } from "@/components/ui/form-alert";
import { Icon } from "@/components/ui/icon";
import { createPublicationAction } from "@/lib/actions/communaute";
import { LEGENDE_MAX, PHOTOS_MAX } from "@/lib/validators/communaute";

const MAX = 5 * 1024 * 1024;
/** Côté le plus long après réduction : bien assez pour l'écran (le serveur réduit à 1 600). */
const COTE_MAX = 2048;

/**
 * Réduit une photo dans le navigateur avant l'envoi (8 photos de téléphone resteraient
 * lourdes). Le serveur revérifie, réduit et nettoie tout ; en cas d'échec, photo d'origine.
 */
async function reduire(file: File): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const ratio = Math.min(1, COTE_MAX / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * ratio);
    canvas.height = Math.round(bitmap.height * ratio);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.85));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file;
  }
}

/** Partager les photos d'un séjour terminé (1 à 4 photos, légende facultative). */
export function PublicationForm({ sejours }: { sejours: { id: string; label: string }[] }) {
  const router = useRouter();
  const notify = useNotify();
  const input = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [reservationId, setReservationId] = useState(sejours[0]?.id ?? "");
  const [legende, setLegende] = useState("");
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const [preparing, setPreparing] = useState(false);

  // Aperçus locaux, libérés quand la liste change ou que le formulaire se ferme.
  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews]);

  async function add(list: FileList | null) {
    setError(undefined);
    const raw = [...(list ?? [])];
    if (raw.some((f) => !f.type.startsWith("image/"))) {
      return setError("Choisissez des images (JPEG, PNG, WebP).");
    }
    setPreparing(true);
    const picked = await Promise.all(raw.slice(0, PHOTOS_MAX - files.length + 1).map(reduire));
    setPreparing(false);
    if (picked.some((f) => !f.type.startsWith("image/"))) {
      return setError("Choisissez des images (JPEG, PNG, WebP).");
    }
    if (picked.some((f) => f.size > MAX)) return setError("Une image dépasse 5 Mo.");
    const next = [...files, ...picked];
    if (next.length > PHOTOS_MAX)
      setError(`${PHOTOS_MAX} photos au maximum : les premières sont gardées.`);
    setFiles(next.slice(0, PHOTOS_MAX));
    if (input.current) input.current.value = "";
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(undefined);
    const data = new FormData();
    data.set("reservationId", reservationId);
    data.set("legende", legende);
    files.forEach((f) => data.append("photos", f));
    startTransition(async () => {
      const result = await createPublicationAction(data);
      if (result.error) return setError(result.error);
      notify(result.success ?? "Publication partagée.");
      setFiles([]);
      setLegende("");
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <FormAlert message={error} />
      <label className="block text-sm font-medium text-gt-teal-900">
        Séjour
        <select
          value={reservationId}
          onChange={(e) => setReservationId(e.target.value)}
          className="mt-1 w-full rounded-xl border border-gt-mist bg-white px-3 py-2 text-sm"
        >
          {sejours.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </label>
      <div>
        <p className="text-sm font-medium text-gt-teal-900">
          Photos{" "}
          <span className="font-normal text-gt-teal-900/75">
            ({files.length}/{PHOTOS_MAX})
          </span>
        </p>
        <div className="mt-2 grid grid-cols-4 gap-2">
          {previews.map((src, i) => (
            <div key={src} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element -- aperçu local */}
              <img
                src={src}
                alt={`Photo ${i + 1}`}
                className="aspect-square w-full rounded-xl object-cover"
              />
              <button
                type="button"
                onClick={() => setFiles(files.filter((_, j) => j !== i))}
                className="absolute top-1 right-1 rounded-full bg-white/90 p-1 text-gt-teal-900 shadow"
                aria-label={`Retirer la photo ${i + 1}`}
              >
                <Icon name="close" className="size-4" />
              </button>
            </div>
          ))}
          {files.length < PHOTOS_MAX ? (
            <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-gt-mist text-xs font-medium text-gt-teal-700 focus-within:ring-2 focus-within:ring-gt-teal-700 hover:bg-gt-teal-50">
              <Icon name="image" className="size-6" />
              Ajouter
              <input
                ref={input}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                onChange={(e) => void add(e.target.files)}
                className="sr-only"
              />
            </label>
          ) : null}
        </div>
        <p className="mt-1 text-xs text-gt-teal-900/75">
          5 Mo au plus par photo. La position GPS et les autres informations du fichier sont
          retirées.
        </p>
      </div>
      <label className="block text-sm font-medium text-gt-teal-900">
        Légende (facultative)
        <textarea
          value={legende}
          onChange={(e) => setLegende(e.target.value)}
          rows={3}
          maxLength={LEGENDE_MAX}
          placeholder="Un souvenir, un conseil pour les prochains voyageurs…"
          className="mt-1 w-full rounded-xl border border-gt-mist px-3 py-2 text-sm"
        />
      </label>
      <p className="text-xs text-gt-teal-900/75">
        Visible par les voyageurs de toutes les agences de la plateforme : votre prénom, votre
        initiale et votre photo de profil.
      </p>
      <Button type="submit" disabled={pending || preparing || files.length === 0 || !reservationId}>
        {pending ? "Publication…" : "Publier"}
      </Button>
    </form>
  );
}
