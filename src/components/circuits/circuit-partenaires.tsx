"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/ui/form-alert";
import { Icon } from "@/components/ui/icon";
import { addCircuitPartenaireAction, removeCircuitPartenaireAction } from "@/lib/actions/circuits";
import { formatMoney } from "@/lib/format";

type Prestation = {
  id: string;
  prestation: string;
  prixUnitaire: number | null;
  inclusDansPrix: boolean;
  partenaire: { nom: string };
  etape: { nom: string } | null;
};

/** Partenaires inclus dans un circuit (§7.3) : prestation, prix unitaire, inclus ou en option. */
export function CircuitPartenaires({
  circuitId,
  prestations,
  partenaires,
  etapes,
  devise,
  canEdit,
}: {
  circuitId: string;
  prestations: readonly Prestation[];
  partenaires: readonly { id: string; nom: string }[];
  etapes: readonly { id: string; nom: string }[];
  devise: string;
  canEdit: boolean;
}) {
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({
    partenaireId: "",
    etapeId: "",
    prestation: "",
    prixUnitaire: "",
    inclusDansPrix: true,
  });

  function run(action: () => Promise<{ error?: string }>, reset = false) {
    setError(undefined);
    startTransition(async () => {
      const result = await action();
      setError(result.error);
      if (!result.error && reset) {
        setForm({
          partenaireId: "",
          etapeId: "",
          prestation: "",
          prixUnitaire: "",
          inclusDansPrix: true,
        });
      }
    });
  }

  const inputClass =
    "mt-1 block w-full rounded-lg border border-gt-mist bg-white px-3 py-2 text-sm text-gt-teal-900";

  return (
    <div className="space-y-4">
      <FormAlert message={error} />
      {prestations.length === 0 ? (
        <p className="text-sm text-gt-teal-900/60">Aucun partenaire inclus pour l&apos;instant.</p>
      ) : (
        <ul className="divide-y divide-gt-mist/60">
          {prestations.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="font-medium text-gt-teal-900">{p.partenaire.nom}</p>
                <p className="text-xs text-gt-teal-900/65">
                  {p.prestation}
                  {p.etape ? ` · à ${p.etape.nom}` : ""} ·{" "}
                  {p.prixUnitaire === null
                    ? "prix à préciser"
                    : formatMoney(p.prixUnitaire, devise)}{" "}
                  · {p.inclusDansPrix ? "inclus dans le prix" : "en option"}
                </p>
              </div>
              {canEdit ? (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => run(() => removeCircuitPartenaireAction({ id: p.id }))}
                  className="grid size-8 shrink-0 place-items-center rounded-full border border-red-200 text-red-700 hover:bg-red-50"
                  aria-label={`Retirer ${p.partenaire.nom}`}
                >
                  <Icon name="close" className="size-4" />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {canEdit ? (
        <form
          method="post"
          onSubmit={(event) => {
            event.preventDefault();
            run(() => addCircuitPartenaireAction({ circuitId, ...form }), true);
          }}
          className="grid gap-3 rounded-2xl bg-gt-teal-50 p-3 sm:grid-cols-2"
        >
          <div>
            <label htmlFor="cp-partenaire" className="block text-sm font-medium text-gt-teal-900">
              Partenaire
            </label>
            <select
              id="cp-partenaire"
              value={form.partenaireId}
              onChange={(event) => setForm({ ...form, partenaireId: event.target.value })}
              className={inputClass}
            >
              <option value="">Choisir…</option>
              {partenaires.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nom}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="cp-etape" className="block text-sm font-medium text-gt-teal-900">
              Étape (facultatif)
            </label>
            <select
              id="cp-etape"
              value={form.etapeId}
              onChange={(event) => setForm({ ...form, etapeId: event.target.value })}
              className={inputClass}
            >
              <option value="">Tout le circuit</option>
              {etapes.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nom}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="cp-prestation" className="block text-sm font-medium text-gt-teal-900">
              Prestation
            </label>
            <input
              id="cp-prestation"
              value={form.prestation}
              onChange={(event) => setForm({ ...form, prestation: event.target.value })}
              placeholder="Nuitée, déjeuner, traversée…"
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="cp-prix" className="block text-sm font-medium text-gt-teal-900">
              Prix unitaire ({devise}, facultatif)
            </label>
            <input
              id="cp-prix"
              inputMode="numeric"
              value={form.prixUnitaire}
              onChange={(event) => setForm({ ...form, prixUnitaire: event.target.value })}
              className={inputClass}
            />
          </div>
          <div className="flex items-center gap-2 sm:col-span-2">
            <input
              id="cp-inclus"
              type="checkbox"
              checked={form.inclusDansPrix}
              onChange={(event) => setForm({ ...form, inclusDansPrix: event.target.checked })}
              className="size-4 accent-gt-teal-700"
            />
            <label htmlFor="cp-inclus" className="text-sm text-gt-teal-900">
              Inclus dans le prix du circuit
            </label>
          </div>
          <div className="sm:col-span-2">
            <Button
              type="submit"
              disabled={pending || !form.partenaireId || !form.prestation.trim()}
            >
              Ajouter la prestation
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
