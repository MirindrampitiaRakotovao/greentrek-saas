"use client";

import { useState, useTransition } from "react";

import { useConfirm, useNotify } from "@/components/ui/dialogs";
import { FormAlert } from "@/components/ui/form-alert";
import {
  answerDepartSurMesureAction,
  cancelDepartSurMesureAction,
  programDepartAction,
} from "@/lib/actions/itineraires-perso";
import { parseIsoDate, toIsoDate } from "@/lib/departs";
import { suggestedDays, suggestedEnd } from "@/lib/sur-mesure";

/**
 * Départ d'un itinéraire sur mesure (étape 9) : formulaire du voyageur (programmer ou
 * modifier), annulation, et réponse de l'agence (confirmer avec tarif, guide et message, ou
 * refuser).
 */

const field =
  "mt-1 w-full rounded-xl border border-gt-mist bg-white px-3 py-2 text-sm text-gt-teal-900 outline-none focus:border-gt-teal-600";
const label = "block text-sm font-medium text-gt-teal-900";

export function ProgramDepartForm({
  itineraireId,
  dureeMinutes,
  minDate,
  initial,
  onDone,
}: {
  itineraireId: string;
  dureeMinutes: number;
  /** Premier jour possible (« AAAA-MM-JJ », lendemain à Madagascar). */
  minDate: string;
  initial?: {
    dateDebut: string;
    dateFin: string;
    nombrePersonnes: number;
    remarques: string | null;
  };
  onDone?: () => void;
}) {
  const notify = useNotify();
  const [dateDebut, setDateDebut] = useState(initial?.dateDebut ?? minDate);
  const [dateFin, setDateFin] = useState(
    initial?.dateFin ?? toIsoDate(suggestedEnd(parseIsoDate(minDate), dureeMinutes)),
  );
  const [finTouchee, setFinTouchee] = useState(Boolean(initial));
  const [personnes, setPersonnes] = useState(String(initial?.nombrePersonnes ?? 1));
  const [remarques, setRemarques] = useState(initial?.remarques ?? "");
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const jours = suggestedDays(dureeMinutes);

  function changeDebut(value: string) {
    setDateDebut(value);
    // Fin proposée d'après la durée de marche, tant que le voyageur ne l'a pas choisie.
    if (!finTouchee && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      setDateFin(toIsoDate(suggestedEnd(parseIsoDate(value), dureeMinutes)));
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(undefined);
    setErrors({});
    startTransition(async () => {
      const result = await programDepartAction({
        itineraireId,
        dateDebut,
        dateFin,
        nombrePersonnes: personnes,
        remarques,
      });
      if (result.error) {
        setError(result.error);
        setErrors(result.fieldErrors ?? {});
        return;
      }
      if (result.success) notify(result.success);
      onDone?.();
    });
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-3">
      <FormAlert message={error} />
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={label}>
          Date de début
          <input
            type="date"
            min={minDate}
            value={dateDebut}
            onChange={(e) => changeDebut(e.target.value)}
            className={field}
            aria-invalid={Boolean(errors.dateDebut)}
          />
          {errors.dateDebut ? (
            <span className="text-xs text-red-700">{errors.dateDebut}</span>
          ) : null}
        </label>
        <label className={label}>
          Date de fin
          <input
            type="date"
            min={dateDebut}
            value={dateFin}
            onChange={(e) => {
              setFinTouchee(true);
              setDateFin(e.target.value);
            }}
            className={field}
            aria-invalid={Boolean(errors.dateFin)}
          />
          {errors.dateFin ? <span className="text-xs text-red-700">{errors.dateFin}</span> : null}
        </label>
      </div>
      <p className="text-xs text-gt-teal-900/75">
        Proposée : {jours} jour{jours > 1 ? "s" : ""} pour {Math.floor(dureeMinutes / 60)} h{" "}
        {String(dureeMinutes % 60).padStart(2, "0")} de marche (6 h par jour), modifiable.
      </p>
      <label className={label}>
        Nombre de personnes
        <input
          type="number"
          inputMode="numeric"
          min={1}
          max={50}
          value={personnes}
          onChange={(e) => setPersonnes(e.target.value)}
          className={field}
          aria-invalid={Boolean(errors.nombrePersonnes)}
        />
        {errors.nombrePersonnes ? (
          <span className="text-xs text-red-700">{errors.nombrePersonnes}</span>
        ) : null}
      </label>
      <label className={label}>
        Remarques pour l&apos;agence (facultatif)
        <textarea
          rows={3}
          maxLength={1000}
          value={remarques}
          onChange={(e) => setRemarques(e.target.value)}
          placeholder="Âges, rythme souhaité, régime alimentaire…"
          className={field}
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-gt-teal-700 px-5 py-2.5 text-sm font-medium text-white hover:bg-gt-teal-800 disabled:opacity-60"
      >
        {pending ? "Envoi…" : initial ? "Enregistrer les changements" : "Programmer le départ"}
      </button>
    </form>
  );
}

/** Suivi du départ côté voyageur : modifier (tant que l'agence n'a pas répondu) ou annuler. */
export function DepartActions({
  depart,
  itineraireId,
  dureeMinutes,
  minDate,
  peutAnnuler,
}: {
  depart: {
    id: string;
    statut: "DEMANDE" | "CONFIRME" | "REFUSE" | "ANNULE";
    dateDebut: string;
    dateFin: string;
    nombrePersonnes: number;
    remarques: string | null;
  };
  itineraireId: string;
  dureeMinutes: number;
  minDate: string;
  peutAnnuler: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const confirm = useConfirm();
  const notify = useNotify();

  async function cancel() {
    const ok = await confirm({
      title: "Annuler ce départ ?",
      message: "L'agence sera prévenue. Vous pourrez programmer un autre départ ensuite.",
      confirmLabel: "Annuler le départ",
      cancelLabel: "Retour",
      tone: "danger",
    });
    if (!ok) return;
    setError(undefined);
    startTransition(async () => {
      const result = await cancelDepartSurMesureAction({ id: depart.id });
      if (result.error) setError(result.error);
      else if (result.success) notify(result.success);
    });
  }

  if (editing) {
    return (
      <div className="space-y-2">
        <ProgramDepartForm
          itineraireId={itineraireId}
          dureeMinutes={dureeMinutes}
          minDate={minDate}
          initial={depart}
          onDone={() => setEditing(false)}
        />
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="text-sm text-gt-teal-700 underline"
        >
          Fermer sans modifier
        </button>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <FormAlert message={error} />
      <div className="flex flex-wrap gap-2">
        {depart.statut === "DEMANDE" ? (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="rounded-full border border-gt-teal-700 px-4 py-2 text-sm font-medium text-gt-teal-700 hover:bg-gt-teal-50"
          >
            Modifier les dates
          </button>
        ) : null}
        {peutAnnuler ? (
          <button
            type="button"
            onClick={cancel}
            disabled={pending}
            className="rounded-full border border-red-700 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
          >
            Annuler le départ
          </button>
        ) : null}
      </div>
    </div>
  );
}

/** Réponse de l'agence à une demande de départ. */
export function AnswerDepartForm({
  id,
  guides,
  devise,
}: {
  id: string;
  guides: readonly { id: string; label: string }[];
  devise: string;
}) {
  const notify = useNotify();
  const [tarif, setTarif] = useState("");
  const [guideId, setGuideId] = useState("");
  const [reponse, setReponse] = useState("");
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  function answer(decision: "CONFIRME" | "REFUSE") {
    setError(undefined);
    startTransition(async () => {
      const result = await answerDepartSurMesureAction({ id, decision, tarif, guideId, reponse });
      if (result.error) return setError(Object.values(result.fieldErrors ?? {})[0] ?? result.error);
      if (result.success) notify(result.success);
    });
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={label}>
          Tarif total ({devise}, facultatif)
          <input
            inputMode="numeric"
            value={tarif}
            onChange={(e) => setTarif(e.target.value.replace(/[^\d]/g, ""))}
            placeholder="ex. 450000"
            className={field}
          />
        </label>
        <label className={label}>
          Guide (facultatif)
          <select value={guideId} onChange={(e) => setGuideId(e.target.value)} className={field}>
            <option value="">— Aucun pour l&apos;instant —</option>
            {guides.map((g) => (
              <option key={g.id} value={g.id}>
                {g.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className={label}>
        Message au voyageur (facultatif)
        <textarea
          rows={3}
          maxLength={1000}
          value={reponse}
          onChange={(e) => setReponse(e.target.value)}
          placeholder="Point de rendez-vous, paiement à l'agence, équipement…"
          className={field}
        />
      </label>
      <p className="text-xs text-gt-teal-900/75">
        Le paiement se règle avec le voyageur, hors plateforme.
      </p>
      <FormAlert message={error} />
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => answer("CONFIRME")}
          className="rounded-full bg-gt-teal-700 px-5 py-2.5 text-sm font-medium text-white hover:bg-gt-teal-800 disabled:opacity-50"
        >
          Confirmer le départ
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => answer("REFUSE")}
          className="rounded-full border border-gt-teal-700 px-5 py-2.5 text-sm font-medium text-gt-teal-700 hover:bg-gt-teal-50 disabled:opacity-50"
        >
          Refuser
        </button>
      </div>
    </div>
  );
}
