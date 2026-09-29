"use client";

import { useMemo, useState, useTransition } from "react";

import { EtapeForm, type EtapeFormValues } from "@/components/circuits/etape-form";
import { Card } from "@/components/dashboard/widgets";
import { MapView, type MapMarker } from "@/components/map/map-view";
import { DeleteButton } from "@/components/ui/delete-button";
import { FormAlert } from "@/components/ui/form-alert";
import { Icon } from "@/components/ui/icon";
import { deleteEtapeAction, moveEtapeAction } from "@/lib/actions/circuits";
import { TYPE_ETAPE_LABELS, type TypeEtape } from "@/lib/validators/circuits";

export type EtapeItem = {
  id: string;
  nom: string;
  type: TypeEtape;
  description: string | null;
  latitude: number;
  longitude: number;
  altitudeM: number | null;
  usages: number;
};

type Selection =
  { kind: "none" } | { kind: "new"; lat: number; lng: number } | { kind: "edit"; id: string };

/**
 * Éditeur des étapes sur carte (§6.5) : cliquer sur la carte pour placer une étape,
 * déplacer un marqueur pour corriger sa position, sélectionner une étape pour la modifier.
 * En lecture seule (rôle GUIDE), la carte et la liste restent consultables.
 */
export function EtapesEditor({
  etapes,
  canEdit,
  canDelete,
}: {
  etapes: readonly EtapeItem[];
  canEdit: boolean;
  canDelete: boolean;
}) {
  const [selection, setSelection] = useState<Selection>({ kind: "none" });
  const [query, setQuery] = useState("");
  const [moveError, setMoveError] = useState<string>();
  const [, startTransition] = useTransition();

  const selected =
    selection.kind === "edit" ? etapes.find((e) => e.id === selection.id) : undefined;

  const markers: MapMarker[] = useMemo(() => {
    const list: MapMarker[] = etapes.map((e) => ({
      id: e.id,
      lat: e.latitude,
      lng: e.longitude,
      label: `${e.nom} (${TYPE_ETAPE_LABELS[e.type]})`,
      tone: selection.kind === "edit" && selection.id === e.id ? "selected" : "default",
      draggable: canEdit,
    }));
    if (selection.kind === "new") {
      list.push({
        id: "__new__",
        lat: selection.lat,
        lng: selection.lng,
        label: "Nouvelle étape",
        badge: "+",
        tone: "new",
      });
    }
    return list;
  }, [etapes, selection, canEdit]);

  const filtered = etapes.filter((e) =>
    e.nom.toLocaleLowerCase("fr").includes(query.trim().toLocaleLowerCase("fr")),
  );

  const formValues: EtapeFormValues | null =
    selection.kind === "new"
      ? {
          nom: "",
          type: "VILLAGE",
          description: null,
          latitude: selection.lat,
          longitude: selection.lng,
          altitudeM: null,
        }
      : selected
        ? { ...selected }
        : null;

  function onDragEnd(id: string, lat: number, lng: number) {
    if (id === "__new__") {
      setSelection({ kind: "new", lat, lng });
      return;
    }
    setMoveError(undefined);
    startTransition(async () => {
      const result = await moveEtapeAction({ id, latitude: lat, longitude: lng });
      setMoveError(result.error);
    });
  }

  return (
    <div className="grid gap-5 xl:grid-cols-3">
      <div className="min-w-0 space-y-3 xl:col-span-2">
        <Card>
          <p className="mb-3 flex items-start gap-2 text-sm text-gt-teal-900/75">
            <Icon name="route" className="mt-0.5 size-4 text-gt-teal-700" />
            {canEdit
              ? "Cliquez sur la carte pour placer une nouvelle étape ; faites glisser un marqueur pour corriger sa position."
              : "Étapes de l'agence (consultation seule)."}
          </p>
          <FormAlert message={moveError} />
          <MapView
            markers={markers}
            fitKey={String(etapes.length)}
            className="h-[520px]"
            onMapClick={canEdit ? (lat, lng) => setSelection({ kind: "new", lat, lng }) : undefined}
            onMarkerClick={(id) => id !== "__new__" && setSelection({ kind: "edit", id })}
            onMarkerDragEnd={canEdit ? onDragEnd : undefined}
          />
          <p className="mt-2 text-xs text-gt-teal-900/55">
            Fond de carte © contributeurs OpenStreetMap. Coordonnées : relevés de terrain ou
            OpenStreetMap uniquement.
          </p>
        </Card>
      </div>

      <div className="min-w-0 space-y-5">
        {canEdit && formValues ? (
          <Card
            title={selection.kind === "new" ? "Nouvelle étape" : "Modifier l'étape"}
            action={
              <button
                type="button"
                onClick={() => setSelection({ kind: "none" })}
                className="rounded-full p-1 text-gt-teal-900/60 hover:bg-gt-teal-50"
                aria-label="Fermer le formulaire"
              >
                <Icon name="close" className="size-4" />
              </button>
            }
          >
            <EtapeForm
              key={selection.kind === "edit" ? selection.id : "new"}
              etape={formValues}
              onDone={() => selection.kind === "new" && setSelection({ kind: "none" })}
            />
            {selected && canDelete ? (
              <div className="mt-4 border-t border-gt-mist/70 pt-4">
                <DeleteButton
                  id={selected.id}
                  label="Supprimer l'étape"
                  confirmMessage={`Supprimer l'étape « ${selected.nom} » ?`}
                  action={async (input) => {
                    const result = await deleteEtapeAction(input);
                    if (!result.error) setSelection({ kind: "none" });
                    return result;
                  }}
                />
              </div>
            ) : null}
          </Card>
        ) : null}

        <Card title={`Étapes (${etapes.length})`}>
          <label htmlFor="etape-search" className="sr-only">
            Filtrer les étapes
          </label>
          <input
            id="etape-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filtrer par nom…"
            className="mb-3 w-full rounded-full border border-gt-mist bg-white px-4 py-2 text-sm outline-none focus:border-gt-teal-600"
          />
          {filtered.length === 0 ? (
            <p className="text-sm text-gt-teal-900/60">Aucune étape.</p>
          ) : (
            <ul className="max-h-[420px] space-y-1 overflow-y-auto">
              {filtered.map((e) => (
                <li key={e.id}>
                  <button
                    type="button"
                    onClick={() => setSelection({ kind: "edit", id: e.id })}
                    className={`flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-sm hover:bg-gt-teal-50 ${
                      selection.kind === "edit" && selection.id === e.id ? "bg-gt-teal-100" : ""
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-gt-teal-900">{e.nom}</span>
                      <span className="text-xs text-gt-teal-900/60">
                        {TYPE_ETAPE_LABELS[e.type]} · {e.latitude.toFixed(4)},{" "}
                        {e.longitude.toFixed(4)}
                      </span>
                    </span>
                    {e.usages > 0 ? (
                      <span className="shrink-0 rounded-full bg-gt-teal-100 px-2 py-0.5 text-[11px] font-semibold text-gt-teal-800">
                        utilisée
                      </span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
