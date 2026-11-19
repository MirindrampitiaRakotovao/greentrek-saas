"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { useNotify } from "@/components/ui/dialogs";
import { FormAlert } from "@/components/ui/form-alert";
import { Icon } from "@/components/ui/icon";
import { Stars } from "@/components/ui/stars";
import { createAvisAction } from "@/lib/actions/avis";

export type RateState =
  | { kind: "anonyme"; loginHref: string }
  | { kind: "rien" }
  | { kind: "noter"; reservationId: string; sejour: string }
  | { kind: "deja"; note: number; statut: string; commentaire: string | null };

const LIBELLES = ["", "Décevant", "Moyen", "Bien", "Très bien", "Excellent"];

/**
 * Noter le circuit depuis sa fiche (après E12) : étoiles et commentaire, pour le voyageur qui
 * a terminé ce circuit (RG 17 : un avis par séjour, publié après relecture de l'agence).
 */
export function RateCircuit({ state }: { state: RateState }) {
  const router = useRouter();
  const notify = useNotify();
  const [note, setNote] = useState(0);
  const [hover, setHover] = useState(0);
  const [commentaire, setCommentaire] = useState("");
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  function envoyer(reservationId: string) {
    if (!note) return setError("Choisissez une note de 1 à 5 étoiles.");
    setError(undefined);
    startTransition(async () => {
      const result = await createAvisAction({ reservationId, note, commentaire });
      if (result.error) return setError(result.error);
      if (result.success) notify(result.success);
      router.refresh();
    });
  }

  return (
    <section
      aria-labelledby="titre-note"
      className="rounded-3xl bg-white p-6 shadow-md ring-1 shadow-gt-teal-900/5 ring-gt-mist/60"
    >
      <h2 id="titre-note" className="text-xl font-semibold text-gt-teal-900">
        Votre note
      </h2>
      {state.kind === "anonyme" ? (
        <p className="mt-2 text-sm text-gt-teal-900/75">
          Vous avez fait ce circuit ?{" "}
          <Link href={state.loginHref} className="font-medium text-gt-teal-700 underline">
            Connectez-vous
          </Link>{" "}
          pour le noter.
        </p>
      ) : state.kind === "rien" ? (
        <p className="mt-2 text-sm text-gt-teal-900/75">
          Vous pourrez noter ce circuit après votre séjour.
        </p>
      ) : state.kind === "deja" ? (
        <div className="mt-2 space-y-1">
          <Stars note={state.note} />
          {state.commentaire ? (
            <p className="text-sm text-gt-teal-900/85">« {state.commentaire} »</p>
          ) : null}
          <p className="text-xs text-gt-teal-900/75">{state.statut}</p>
        </div>
      ) : (
        <div className="mt-2 space-y-3">
          <p className="text-sm text-gt-teal-900/75">Votre séjour du {state.sejour}</p>
          <div
            role="radiogroup"
            aria-label="Note sur 5"
            className="flex items-center gap-1"
            onMouseLeave={() => setHover(0)}
          >
            {[1, 2, 3, 4, 5].map((n) => {
              const on = (hover || note) >= n;
              return (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={note === n}
                  aria-label={`${n} étoile${n > 1 ? "s" : ""} : ${LIBELLES[n]}`}
                  onClick={() => setNote(n)}
                  onMouseEnter={() => setHover(n)}
                  className="rounded-full p-1 transition hover:scale-110"
                >
                  <Icon
                    name="star"
                    className={`size-8 ${on ? "fill-gt-sand-300 text-[#b7791f]" : "text-gt-mist"}`}
                  />
                </button>
              );
            })}
            <span className="ml-2 text-sm font-medium text-gt-teal-900" aria-live="polite">
              {LIBELLES[hover || note]}
            </span>
          </div>
          <label className="block text-sm font-medium text-gt-teal-900">
            Votre commentaire (facultatif)
            <textarea
              value={commentaire}
              onChange={(e) => setCommentaire(e.target.value)}
              rows={3}
              maxLength={1000}
              placeholder="Le sentier, les villages, le guide…"
              className="mt-1 w-full rounded-xl border border-gt-mist px-3 py-2 text-sm"
            />
          </label>
          <FormAlert message={error} />
          <button
            type="button"
            disabled={pending}
            onClick={() => envoyer(state.reservationId)}
            className="rounded-full bg-gt-teal-700 px-5 py-2.5 text-sm font-medium text-white hover:bg-gt-teal-800 disabled:opacity-50"
          >
            {pending ? "Envoi…" : "Publier ma note"}
          </button>
          <p className="text-xs text-gt-teal-900/75">
            Votre avis sera publié après relecture par l&apos;agence.
          </p>
        </div>
      )}
    </section>
  );
}
