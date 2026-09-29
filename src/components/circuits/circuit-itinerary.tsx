"use client";

import { useState, useTransition } from "react";

import { MapView, type MapMarker } from "@/components/map/map-view";
import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/ui/form-alert";
import { Icon } from "@/components/ui/icon";
import {
  addCircuitEtapeAction,
  moveCircuitEtapeAction,
  removeCircuitEtapeAction,
  updateCircuitEtapeAction,
} from "@/lib/actions/circuits";
import { TYPE_ETAPE_LABELS, type TypeEtape } from "@/lib/validators/circuits";

export type ItineraryStep = {
  id: string;
  ordre: number;
  jour: number | null;
  dureeSejourMin: number | null;
  notes: string | null;
  etape: { id: string; nom: string; type: TypeEtape; latitude: number; longitude: number };
};

type EtapeOption = { id: string; nom: string; type: TypeEtape };

/**
 * Itinéraire d'un circuit : étapes ordonnées (RG 4), réordonnées par boutons ↑ ↓ (accessibles
 * au clavier), et leur tracé sur la carte. Le tracé relie les étapes en ligne droite : les
 * vrais chemins (tronçons, plus courts chemins) arrivent aux étapes E5 et E6.
 */
export function CircuitItinerary({
  circuitId,
  steps,
  etapes,
  canEdit,
}: {
  circuitId: string;
  steps: readonly ItineraryStep[];
  etapes: readonly EtapeOption[];
  canEdit: boolean;
}) {
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const [etapeId, setEtapeId] = useState("");
  const [jour, setJour] = useState("");
  const [editing, setEditing] = useState<string | null>(null);

  function run(action: () => Promise<{ error?: string }>) {
    setError(undefined);
    startTransition(async () => {
      const result = await action();
      setError(result.error);
    });
  }

  const markers: MapMarker[] = steps.map((s) => ({
    id: s.id,
    lat: s.etape.latitude,
    lng: s.etape.longitude,
    label: `${s.ordre}. ${s.etape.nom}`,
    badge: String(s.ordre),
  }));
  const path = steps.map((s) => [s.etape.latitude, s.etape.longitude] as [number, number]);

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <div className="min-w-0 space-y-4">
        <FormAlert message={error} />
        {steps.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-gt-mist bg-gt-teal-50 px-4 py-6 text-center text-sm text-gt-teal-900/60">
            Aucune étape. Un circuit doit en compter au moins deux pour être publié.
          </p>
        ) : (
          <ol className="space-y-2">
            {steps.map((s, index) => (
              <li key={s.id} className="rounded-2xl border border-gt-mist/70 bg-white p-3">
                <div className="flex items-center gap-3">
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-gt-teal-700 text-sm font-semibold text-white">
                    {s.ordre}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-gt-teal-900">{s.etape.nom}</p>
                    <p className="text-xs text-gt-teal-900/60">
                      {TYPE_ETAPE_LABELS[s.etape.type]}
                      {s.jour ? ` · jour ${s.jour}` : ""}
                      {s.dureeSejourMin ? ` · ${s.dureeSejourMin} min sur place` : ""}
                    </p>
                  </div>
                  {canEdit ? (
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        disabled={pending || index === 0}
                        onClick={() =>
                          run(() => moveCircuitEtapeAction({ id: s.id, direction: "up" }))
                        }
                        className="grid size-8 place-items-center rounded-full border border-gt-mist text-gt-teal-900 hover:bg-gt-teal-50 disabled:opacity-30"
                        aria-label={`Monter ${s.etape.nom}`}
                      >
                        <Icon name="arrowUp" className="size-4" />
                      </button>
                      <button
                        type="button"
                        disabled={pending || index === steps.length - 1}
                        onClick={() =>
                          run(() => moveCircuitEtapeAction({ id: s.id, direction: "down" }))
                        }
                        className="grid size-8 place-items-center rounded-full border border-gt-mist text-gt-teal-900 hover:bg-gt-teal-50 disabled:opacity-30"
                        aria-label={`Descendre ${s.etape.nom}`}
                      >
                        <Icon name="arrowDown" className="size-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditing(editing === s.id ? null : s.id)}
                        className="grid size-8 place-items-center rounded-full border border-gt-mist text-gt-teal-900 hover:bg-gt-teal-50"
                        aria-label={`Détails de ${s.etape.nom}`}
                        aria-expanded={editing === s.id}
                      >
                        <Icon name="settings" className="size-4" />
                      </button>
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => {
                          if (window.confirm(`Retirer « ${s.etape.nom} » du circuit ?`)) {
                            run(() => removeCircuitEtapeAction({ id: s.id }));
                          }
                        }}
                        className="grid size-8 place-items-center rounded-full border border-red-200 text-red-700 hover:bg-red-50"
                        aria-label={`Retirer ${s.etape.nom}`}
                      >
                        <Icon name="close" className="size-4" />
                      </button>
                    </div>
                  ) : null}
                </div>
                {s.notes ? (
                  <p className="mt-2 pl-11 text-xs text-gt-teal-900/70">{s.notes}</p>
                ) : null}
                {canEdit && editing === s.id ? (
                  <StepDetailsForm
                    step={s}
                    pending={pending}
                    onSave={(values) =>
                      run(async () => {
                        const result = await updateCircuitEtapeAction({ id: s.id, ...values });
                        if (!result.error) setEditing(null);
                        return result;
                      })
                    }
                  />
                ) : null}
              </li>
            ))}
          </ol>
        )}

        {canEdit ? (
          <form
            method="post"
            onSubmit={(event) => {
              event.preventDefault();
              run(async () => {
                const result = await addCircuitEtapeAction({
                  circuitId,
                  etapeId,
                  jour,
                  dureeSejourMin: "",
                  notes: "",
                });
                if (!result.error) setEtapeId("");
                return result;
              });
            }}
            className="grid gap-3 rounded-2xl bg-gt-teal-50 p-3 sm:grid-cols-[1fr_90px_auto] sm:items-end"
          >
            <div>
              <label htmlFor="add-etape" className="block text-sm font-medium text-gt-teal-900">
                Ajouter une étape
              </label>
              <select
                id="add-etape"
                value={etapeId}
                onChange={(event) => setEtapeId(event.target.value)}
                className="mt-1 block w-full rounded-lg border border-gt-mist bg-white px-3 py-2 text-sm text-gt-teal-900"
              >
                <option value="">Choisir une étape…</option>
                {etapes.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.nom} ({TYPE_ETAPE_LABELS[e.type]})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="add-jour" className="block text-sm font-medium text-gt-teal-900">
                Jour
              </label>
              <input
                id="add-jour"
                inputMode="numeric"
                value={jour}
                onChange={(event) => setJour(event.target.value)}
                placeholder="1"
                className="mt-1 block w-full rounded-lg border border-gt-mist bg-white px-3 py-2 text-sm text-gt-teal-900"
              />
            </div>
            <Button type="submit" disabled={pending || !etapeId}>
              Ajouter
            </Button>
          </form>
        ) : null}
      </div>

      <div className="min-w-0">
        <MapView
          markers={markers}
          path={path}
          fitKey={steps.map((s) => s.id).join()}
          className="h-[400px]"
        />
        <p className="mt-2 text-xs text-gt-teal-900/55">
          Tracé indicatif en ligne droite entre les étapes (chemins réels : étapes E5 et E6). Fond
          de carte © contributeurs OpenStreetMap.
        </p>
      </div>
    </div>
  );
}

function StepDetailsForm({
  step,
  pending,
  onSave,
}: {
  step: ItineraryStep;
  pending: boolean;
  onSave: (values: { jour: string; dureeSejourMin: string; notes: string }) => void;
}) {
  const [jour, setJour] = useState(step.jour?.toString() ?? "");
  const [duree, setDuree] = useState(step.dureeSejourMin?.toString() ?? "");
  const [notes, setNotes] = useState(step.notes ?? "");
  const id = `step-${step.id}`;
  return (
    <form
      method="post"
      onSubmit={(event) => {
        event.preventDefault();
        onSave({ jour, dureeSejourMin: duree, notes });
      }}
      className="mt-3 grid gap-2 border-t border-gt-mist/70 pt-3 sm:grid-cols-2"
    >
      <div>
        <label htmlFor={`${id}-jour`} className="block text-xs font-medium text-gt-teal-900">
          Jour
        </label>
        <input
          id={`${id}-jour`}
          inputMode="numeric"
          value={jour}
          onChange={(event) => setJour(event.target.value)}
          className="mt-1 block w-full rounded-lg border border-gt-mist px-2 py-1.5 text-sm"
        />
      </div>
      <div>
        <label htmlFor={`${id}-duree`} className="block text-xs font-medium text-gt-teal-900">
          Durée sur place (minutes)
        </label>
        <input
          id={`${id}-duree`}
          inputMode="numeric"
          value={duree}
          onChange={(event) => setDuree(event.target.value)}
          className="mt-1 block w-full rounded-lg border border-gt-mist px-2 py-1.5 text-sm"
        />
      </div>
      <div className="sm:col-span-2">
        <label htmlFor={`${id}-notes`} className="block text-xs font-medium text-gt-teal-900">
          Notes
        </label>
        <input
          id={`${id}-notes`}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          className="mt-1 block w-full rounded-lg border border-gt-mist px-2 py-1.5 text-sm"
        />
      </div>
      <div className="sm:col-span-2">
        <Button type="submit" disabled={pending}>
          Enregistrer
        </Button>
      </div>
    </form>
  );
}
