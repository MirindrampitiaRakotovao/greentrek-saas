"use client";

import Link from "next/link";
import { useMemo, useState, useSyncExternalStore, useTransition } from "react";

import { EtapeForm, type EtapeFormValues } from "@/components/circuits/etape-form";
import {
  suggestedTroncon,
  TronconForm,
  type TronconValues,
} from "@/components/circuits/troncon-form";
import { type MapEdge, type MapFocus, type MapMarker, MapView } from "@/components/map/map-view";
import { DeleteButton } from "@/components/ui/delete-button";
import { FormAlert } from "@/components/ui/form-alert";
import { Icon, type IconName } from "@/components/ui/icon";
import { deleteEtapeAction, moveEtapeAction } from "@/lib/actions/circuits";
import { haversineKm } from "@/lib/graph/haversine";
import { satellitePreviewUrl } from "@/lib/map/tiles";
import {
  DIFFICULTE_TRONCON_LABELS,
  TYPE_ETAPE_LABELS,
  TYPES_ETAPE,
  type TypeEtape,
} from "@/lib/validators/circuits";

/**
 * Éditeur du graphe sur carte (§6.5), au style « Google Maps » demandé par l'étudiant :
 * panneau flottant (recherche, listes, fiches), pastilles de filtre par type, carte plein
 * cadre, et deux vues :
 * - Étapes (nœuds) : cliquer sur la carte pour placer une étape, glisser une épingle pour la
 *   déplacer, modifier, supprimer ;
 * - Tronçons (arêtes) : cliquer sur une étape de départ puis sur une étape d'arrivée pour
 *   créer un tronçon (distance et durée proposées), cliquer sur un tronçon pour le modifier.
 * Uniquement des données réelles : pas de photo ni de météo inventées ; l'image de la fiche
 * est une vraie vue satellite (Esri World Imagery) du lieu.
 */

export type EtapeItem = {
  id: string;
  nom: string;
  type: TypeEtape;
  description: string | null;
  latitude: number;
  longitude: number;
  altitudeM: number | null;
  usages: number;
  circuits: { id: string; titre: string }[];
};

export type TronconItem = TronconValues & { id: string };

type Mode =
  | { kind: "list" }
  | { kind: "view"; id: string }
  | { kind: "edit"; id: string }
  | { kind: "new"; lat: number; lng: number };

type EdgeMode =
  | { kind: "list" }
  | { kind: "pick"; departId?: string }
  | { kind: "new"; departId: string; arriveeId: string }
  | { kind: "edit"; id: string };

type View = "etapes" | "troncons";

const TYPE_ICONS: Record<TypeEtape, IconName> = {
  VILLAGE: "home",
  POINT_INTERET: "sparkles",
  HEBERGEMENT: "building",
  RESTAURATION: "utensils",
  EMBARCADERE: "anchor",
  AUTRE: "pin",
};

const TYPE_PLURALS: Record<TypeEtape, string> = {
  VILLAGE: "Villages",
  POINT_INTERET: "Points d'intérêt",
  HEBERGEMENT: "Hébergements",
  RESTAURATION: "Restauration",
  EMBARCADERE: "Embarcadères",
  AUTRE: "Autres",
};

/** Comparaison sans accents ni majuscules (« mahambo » trouve « Mahambo »). */
const normalize = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("fr");

const formatKm = (km: number) => `${km.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} km`;

function formatDuree(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h} h ${String(m).padStart(2, "0")}` : `${m} min`;
}

/** Largeur du panneau flottant sur grand écran (px), laissée libre lors des recadrages. */
const PANEL_WIDTH = 400;

/**
 * Grand écran (≥ 1024 px, point de rupture `lg`) : le panneau flotte SUR la carte. Sur
 * mobile, il est sous la carte : réserver sa largeur lors du recadrage repousserait toutes
 * les épingles hors de l'écran.
 */
const DESKTOP_QUERY = "(min-width: 1024px)";
function subscribeDesktop(onChange: () => void) {
  const media = window.matchMedia(DESKTOP_QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}
function useIsDesktop(): boolean {
  return useSyncExternalStore(
    subscribeDesktop,
    () => window.matchMedia(DESKTOP_QUERY).matches,
    () => true,
  );
}

export function MapExplorer({
  etapes,
  troncons,
  canEdit,
  canDelete,
  canEditTroncons,
  canDeleteTroncons,
}: {
  etapes: readonly EtapeItem[];
  troncons: readonly TronconItem[];
  canEdit: boolean;
  canDelete: boolean;
  canEditTroncons: boolean;
  canDeleteTroncons: boolean;
}) {
  const [view, setView] = useState<View>("etapes");
  const [mode, setMode] = useState<Mode>({ kind: "list" });
  const [edgeMode, setEdgeMode] = useState<EdgeMode>({ kind: "list" });
  const [query, setQuery] = useState("");
  const [types, setTypes] = useState<ReadonlySet<TypeEtape>>(new Set());
  const [focus, setFocus] = useState<MapFocus>();
  const [error, setError] = useState<string>();
  const [, startTransition] = useTransition();
  const isDesktop = useIsDesktop();

  const byId = useMemo(() => new Map(etapes.map((e) => [e.id, e])), [etapes]);
  const nom = (id: string) => byId.get(id)?.nom ?? "?";

  const presentTypes = TYPES_ETAPE.filter((type) => etapes.some((e) => e.type === type));
  const typeFiltered = etapes.filter((e) => types.size === 0 || types.has(e.type));
  const visible =
    view === "etapes"
      ? typeFiltered.filter((e) => normalize(e.nom).includes(normalize(query.trim())))
      : typeFiltered;
  const visibleIds = new Set(visible.map((e) => e.id));

  const selectedId = mode.kind === "view" || mode.kind === "edit" ? mode.id : undefined;
  const selected = selectedId ? byId.get(selectedId) : undefined;
  const selectedEdgeId = edgeMode.kind === "edit" ? edgeMode.id : undefined;
  const departId =
    edgeMode.kind === "pick" || edgeMode.kind === "new" ? edgeMode.departId : undefined;
  const arriveeId = edgeMode.kind === "new" ? edgeMode.arriveeId : undefined;

  const markers: MapMarker[] = visible.map((e) => ({
    id: e.id,
    lat: e.latitude,
    lng: e.longitude,
    label: e.nom,
    tone:
      view === "etapes"
        ? e.id === selectedId
          ? "selected"
          : "default"
        : e.id === departId
          ? "selected"
          : e.id === arriveeId
            ? "new"
            : "default",
    draggable: view === "etapes" && canEdit,
  }));
  if (view === "etapes" && mode.kind === "new") {
    markers.push({
      id: "__new__",
      lat: mode.lat,
      lng: mode.lng,
      label: "Nouvelle étape",
      tone: "new",
    });
  }

  const edges: MapEdge[] = troncons
    .filter((t) => visibleIds.has(t.etapeDepartId) && visibleIds.has(t.etapeArriveeId))
    .map((t) => {
      const a = byId.get(t.etapeDepartId)!;
      const b = byId.get(t.etapeArriveeId)!;
      return {
        id: t.id,
        from: [a.latitude, a.longitude],
        to: [b.latitude, b.longitude],
        label: `${a.nom} ${t.bidirectionnel ? "↔" : "→"} ${b.nom} · ${formatKm(t.distanceKm)} · ${formatDuree(t.dureeMinutes)}${t.distanceEstimee ? " (estimé)" : ""}`,
        dashed: t.distanceEstimee,
        tone: view === "etapes" ? "muted" : t.id === selectedEdgeId ? "selected" : "default",
      };
    });

  function select(etape: EtapeItem) {
    setView("etapes");
    setMode({ kind: "view", id: etape.id });
    setFocus({ lat: etape.latitude, lng: etape.longitude, key: `${etape.id}-${Date.now()}` });
  }

  function openTroncon(id: string) {
    const t = troncons.find((x) => x.id === id);
    setView("troncons");
    setEdgeMode({ kind: "edit", id });
    if (t) {
      const a = byId.get(t.etapeDepartId);
      const b = byId.get(t.etapeArriveeId);
      if (a && b) {
        setFocus({
          lat: (a.latitude + b.latitude) / 2,
          lng: (a.longitude + b.longitude) / 2,
          key: `${id}-${Date.now()}`,
        });
      }
    }
  }

  /** Vue Tronçons : 1er clic = départ, 2e clic = arrivée (puis formulaire prérempli). */
  function pickEtape(id: string) {
    if (!canEditTroncons) {
      const etape = byId.get(id);
      if (etape) select(etape);
      return;
    }
    if (edgeMode.kind === "pick" && edgeMode.departId && edgeMode.departId !== id) {
      setEdgeMode({ kind: "new", departId: edgeMode.departId, arriveeId: id });
    } else {
      setEdgeMode({ kind: "pick", departId: id });
    }
  }

  function toggleType(type: TypeEtape) {
    const next = new Set(types);
    if (next.has(type)) next.delete(type);
    else next.add(type);
    setTypes(next);
  }

  function onDragEnd(id: string, lat: number, lng: number) {
    if (id === "__new__") {
      setMode({ kind: "new", lat, lng });
      return;
    }
    setError(undefined);
    startTransition(async () => {
      const result = await moveEtapeAction({ id, latitude: lat, longitude: lng });
      setError(result.error);
    });
  }

  function switchView(next: View) {
    setView(next);
    setQuery("");
    setMode({ kind: "list" });
    setEdgeMode({ kind: "list" });
  }

  const formValues: EtapeFormValues | null =
    mode.kind === "new"
      ? {
          nom: "",
          type: "VILLAGE",
          description: null,
          latitude: mode.lat,
          longitude: mode.lng,
          altitudeM: null,
        }
      : mode.kind === "edit" && selected
        ? { ...selected }
        : null;

  const panelKey =
    view === "etapes"
      ? `e-${mode.kind}-${selectedId ?? ""}`
      : `t-${edgeMode.kind}-${selectedEdgeId ?? departId ?? ""}-${arriveeId ?? ""}`;

  return (
    <div className="relative flex flex-col overflow-hidden rounded-3xl border border-gt-mist/70 bg-white lg:block lg:h-[calc(100dvh-9.5rem)] lg:min-h-[620px]">
      {/* ── Carte plein cadre ── */}
      <div className="relative h-[62vh] lg:absolute lg:inset-0 lg:h-auto">
        <MapView
          markers={markers}
          edges={edges}
          fitKey={`${etapes.length}-${[...types].join()}-${isDesktop}`}
          fitPadding={{ left: isDesktop ? PANEL_WIDTH : 0 }}
          // Le panneau flottant couvre la gauche de la carte sur grand écran.
          leftControlsClassName="left-3 lg:left-[424px]"
          focus={focus}
          className="h-full"
          onMapClick={
            view === "etapes" && canEdit
              ? (lat, lng) => setMode({ kind: "new", lat, lng })
              : undefined
          }
          onMarkerClick={(id) => {
            if (view === "troncons") pickEtape(id);
            else {
              const etape = byId.get(id);
              if (etape) select(etape);
            }
          }}
          onMarkerDragEnd={view === "etapes" && canEdit ? onDragEnd : undefined}
          onEdgeClick={openTroncon}
        />

        {/* ── Pastilles de filtre (comme « Restaurants », « Hôtels »… sur la maquette) ── */}
        <div className="pointer-events-none absolute top-3 right-3 left-3 z-[1000] lg:left-[calc(400px+2rem)]">
          <div className="pointer-events-auto flex gap-2 overflow-x-auto pb-1">
            {presentTypes.map((type) => {
              const active = types.has(type);
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => toggleType(type)}
                  aria-pressed={active}
                  className={`flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium shadow-md transition ${
                    active
                      ? "bg-gt-teal-700 text-white"
                      : "bg-white text-gt-teal-900 hover:bg-gt-teal-50"
                  }`}
                >
                  <Icon name={TYPE_ICONS[type]} className="size-4" />
                  {TYPE_PLURALS[type]}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Panneau flottant (sous la carte sur mobile) ── */}
      <aside
        className="relative z-[1001] flex flex-col bg-white lg:absolute lg:top-3 lg:bottom-3 lg:left-3 lg:w-[400px] lg:overflow-hidden lg:rounded-2xl lg:shadow-xl"
        aria-label="Graphe des étapes et des tronçons"
      >
        <div className="space-y-3 border-b border-gt-mist/60 p-3">
          <div className="relative">
            <label htmlFor="map-search" className="sr-only">
              {view === "etapes" ? "Rechercher un lieu" : "Rechercher un tronçon"}
            </label>
            <input
              id="map-search"
              type="search"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                if (view === "etapes" && mode.kind === "view") setMode({ kind: "list" });
                if (view === "troncons" && edgeMode.kind === "edit") setEdgeMode({ kind: "list" });
              }}
              placeholder={
                view === "etapes" ? "Rechercher un lieu…" : "Rechercher un tronçon (étape)…"
              }
              autoComplete="off"
              className="gt-search-no-cancel w-full rounded-full border border-gt-mist bg-white py-3 pr-20 pl-5 text-[15px] text-gt-teal-900 shadow-sm outline-none focus:border-gt-teal-600 focus:ring-2 focus:ring-gt-teal-500/20"
            />
            <span className="absolute top-1/2 right-3 flex -translate-y-1/2 items-center gap-1 text-gt-teal-900/75">
              <Icon name="search" className="size-5" />
              {query || mode.kind !== "list" || edgeMode.kind !== "list" ? (
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    setMode({ kind: "list" });
                    setEdgeMode({ kind: "list" });
                  }}
                  className="rounded-full p-1 hover:bg-gt-teal-50"
                  aria-label="Effacer et revenir à la liste"
                >
                  <Icon name="close" className="size-5" />
                </button>
              ) : null}
            </span>
          </div>
          <div
            role="tablist"
            aria-label="Vue"
            className="grid grid-cols-2 rounded-full bg-gt-teal-50 p-1"
          >
            {(
              [
                ["etapes", `Étapes (${etapes.length})`],
                ["troncons", `Tronçons (${troncons.length})`],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={view === id}
                onClick={() => switchView(id)}
                className={`rounded-full py-2 text-sm font-medium transition ${
                  view === id
                    ? "bg-white text-gt-teal-900 shadow-sm"
                    : "text-gt-teal-900/75 hover:text-gt-teal-900"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div
          // Nouvelle clé à chaque changement de vue : le panneau revient en haut (sinon la
          // fiche d'un lieu s'ouvrirait à la position de défilement de la liste).
          key={panelKey}
          className="max-h-[70vh] min-h-0 flex-1 overflow-y-auto lg:max-h-none"
        >
          <FormAlert message={error} />
          {view === "troncons" ? (
            <TronconPanel
              edgeMode={edgeMode}
              troncons={troncons}
              etapes={etapes}
              query={query}
              nom={nom}
              canEdit={canEditTroncons}
              canDelete={canDeleteTroncons}
              onStartPick={() => setEdgeMode({ kind: "pick" })}
              onOpen={openTroncon}
              onBack={() => setEdgeMode({ kind: "list" })}
            />
          ) : mode.kind === "view" && selected ? (
            <PlaceCard
              etape={selected}
              etapes={etapes}
              troncons={troncons}
              nom={nom}
              canEdit={canEdit}
              canDelete={canDelete}
              onEdit={() => setMode({ kind: "edit", id: selected.id })}
              onCenter={() => select(selected)}
              onSelect={select}
              onOpenTroncon={openTroncon}
              onDeleted={() => setMode({ kind: "list" })}
            />
          ) : formValues ? (
            <div className="p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gt-teal-900">
                  {mode.kind === "new" ? "Nouvelle étape" : `Modifier « ${selected?.nom} »`}
                </h2>
                <button
                  type="button"
                  onClick={() =>
                    setMode(selected ? { kind: "view", id: selected.id } : { kind: "list" })
                  }
                  className="text-sm font-medium text-gt-teal-700 underline"
                >
                  Annuler
                </button>
              </div>
              {mode.kind === "new" ? (
                <p className="mb-3 text-xs text-gt-teal-900/75">
                  Position prise au clic ; déplacez l&apos;épingle orange pour l&apos;ajuster.
                </p>
              ) : null}
              <EtapeForm
                key={mode.kind === "edit" ? mode.id : `new-${mode.kind === "new" ? mode.lat : 0}`}
                etape={formValues}
                onDone={() =>
                  setMode(selected ? { kind: "view", id: selected.id } : { kind: "list" })
                }
              />
            </div>
          ) : (
            <ResultList
              etapes={visible}
              total={etapes.length}
              canEdit={canEdit}
              onSelect={select}
            />
          )}
        </div>
      </aside>
    </div>
  );
}

/** Panneau de la vue Tronçons : liste, sélection départ/arrivée, formulaire. */
function TronconPanel({
  edgeMode,
  troncons,
  etapes,
  query,
  nom,
  canEdit,
  canDelete,
  onStartPick,
  onOpen,
  onBack,
}: {
  edgeMode: EdgeMode;
  troncons: readonly TronconItem[];
  etapes: readonly EtapeItem[];
  query: string;
  nom: (id: string) => string;
  canEdit: boolean;
  canDelete: boolean;
  onStartPick: () => void;
  onOpen: (id: string) => void;
  onBack: () => void;
}) {
  const back = (
    <button
      type="button"
      onClick={onBack}
      className="text-sm font-medium text-gt-teal-700 underline"
    >
      Retour à la liste
    </button>
  );

  if (edgeMode.kind === "pick") {
    return (
      <div className="space-y-4 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gt-teal-900">Nouveau tronçon</h2>
          {back}
        </div>
        <ol className="space-y-2 text-sm">
          <li className="flex items-center gap-2">
            <span className="grid size-6 place-items-center rounded-full bg-[#d93025] text-xs font-bold text-white">
              1
            </span>
            {edgeMode.departId ? (
              <span>
                Départ : <strong>{nom(edgeMode.departId)}</strong>
              </span>
            ) : (
              <span>Cliquez sur l&apos;étape de départ, sur la carte.</span>
            )}
          </li>
          <li className="flex items-center gap-2 text-gt-teal-900/75">
            <span className="grid size-6 place-items-center rounded-full bg-gt-chart-2 text-xs font-bold text-white">
              2
            </span>
            Puis sur l&apos;étape d&apos;arrivée.
          </li>
        </ol>
        <p className="text-xs text-gt-teal-900/75">
          La distance (Haversine × sinuosité) et la durée (Naismith adaptée) seront proposées,
          modifiables.
        </p>
      </div>
    );
  }

  if (edgeMode.kind === "new" || edgeMode.kind === "edit") {
    const existing =
      edgeMode.kind === "edit" ? troncons.find((t) => t.id === edgeMode.id) : undefined;
    const depart = etapes.find((e) => e.id === (edgeMode.kind === "new" ? edgeMode.departId : ""));
    const arrivee = etapes.find(
      (e) => e.id === (edgeMode.kind === "new" ? edgeMode.arriveeId : ""),
    );
    const values = existing ?? (depart && arrivee ? suggestedTroncon(depart, arrivee) : undefined);
    if (!values) return <div className="p-4">{back}</div>;
    return (
      <div className="p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-gt-teal-900">
            {existing ? "Tronçon" : "Nouveau tronçon"}
          </h2>
          {back}
        </div>
        <p className="mb-4 text-sm text-gt-teal-900/75">
          {nom(values.etapeDepartId)} {values.bidirectionnel ? "↔" : "→"}{" "}
          {nom(values.etapeArriveeId)}
        </p>
        {canEdit ? (
          <TronconForm troncon={values} etapes={etapes} canDelete={canDelete} onDone={onBack} />
        ) : (
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-gt-teal-900/75">Distance</dt>
              <dd className="font-medium">
                {formatKm(values.distanceKm)}
                {values.distanceEstimee ? " (estimée)" : ""}
              </dd>
            </div>
            <div>
              <dt className="text-gt-teal-900/75">Durée</dt>
              <dd className="font-medium">{formatDuree(values.dureeMinutes)}</dd>
            </div>
            <div>
              <dt className="text-gt-teal-900/75">Difficulté</dt>
              <dd className="font-medium">{DIFFICULTE_TRONCON_LABELS[values.difficulte]}</dd>
            </div>
            <div>
              <dt className="text-gt-teal-900/75">Dénivelé</dt>
              <dd className="font-medium">
                {values.deniveleM === null ? "—" : `${values.deniveleM} m`}
              </dd>
            </div>
            {values.commentaire ? (
              <div className="col-span-2">
                <dt className="text-gt-teal-900/75">Commentaire</dt>
                <dd>{values.commentaire}</dd>
              </div>
            ) : null}
          </dl>
        )}
      </div>
    );
  }

  const q = normalize(query.trim());
  const list = troncons
    .filter((t) => normalize(`${nom(t.etapeDepartId)} ${nom(t.etapeArriveeId)}`).includes(q))
    .sort((a, b) => nom(a.etapeDepartId).localeCompare(nom(b.etapeDepartId), "fr"));
  const estimes = troncons.filter((t) => t.distanceEstimee).length;

  return (
    <div>
      <div className="space-y-3 px-4 pt-3 pb-2">
        {canEdit ? (
          <button
            type="button"
            onClick={onStartPick}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-gt-teal-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-gt-teal-800"
          >
            <Icon name="plus" className="size-4" />
            Nouveau tronçon
          </button>
        ) : null}
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gt-teal-900/75">
          <span className="flex items-center gap-1.5">
            <span aria-hidden="true" className="h-1 w-6 rounded bg-[#1a73e8]" />
            mesuré
          </span>
          <span className="flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="h-0 w-6 border-t-[3px] border-dashed border-[#1a73e8]"
            />
            estimé ({estimes}/{troncons.length})
          </span>
        </div>
      </div>
      {list.length === 0 ? (
        <p className="px-4 py-6 text-sm text-gt-teal-900/75">Aucun tronçon.</p>
      ) : (
        <ul>
          {list.map((t) => (
            <li key={t.id} className="border-t border-gt-mist/50">
              <button
                type="button"
                onClick={() => onOpen(t.id)}
                className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left hover:bg-gt-teal-50"
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium text-gt-teal-900">
                    {nom(t.etapeDepartId)} {t.bidirectionnel ? "↔" : "→"} {nom(t.etapeArriveeId)}
                  </span>
                  <span className="block text-xs text-gt-teal-900/75">
                    {formatKm(t.distanceKm)} · {formatDuree(t.dureeMinutes)} · difficulté{" "}
                    {t.difficulte}
                  </span>
                </span>
                {t.distanceEstimee ? (
                  <span className="shrink-0 rounded-full bg-gt-sand-200 px-2 py-0.5 text-[11px] font-semibold text-gt-teal-900">
                    estimé
                  </span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ResultList({
  etapes,
  total,
  canEdit,
  onSelect,
}: {
  etapes: readonly EtapeItem[];
  total: number;
  canEdit: boolean;
  onSelect: (etape: EtapeItem) => void;
}) {
  return (
    <div>
      <p className="px-4 pt-3 pb-2 text-xs text-gt-teal-900/75">
        {etapes.length} lieu(x) sur {total}
        {canEdit ? " · cliquez sur la carte pour ajouter une étape" : ""}
      </p>
      {etapes.length === 0 ? (
        <p className="px-4 py-6 text-sm text-gt-teal-900/75">Aucun lieu ne correspond.</p>
      ) : (
        <ul>
          {etapes.map((e) => (
            <li key={e.id} className="border-t border-gt-mist/50 first:border-t-0">
              <button
                type="button"
                onClick={() => onSelect(e)}
                className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-gt-teal-50"
              >
                <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-full bg-gt-teal-100 text-gt-teal-800">
                  <Icon name={TYPE_ICONS[e.type]} className="size-4" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-medium text-gt-teal-900">{e.nom}</span>
                  <span className="block text-xs text-gt-teal-900/75">
                    {TYPE_ETAPE_LABELS[e.type]}
                    {e.circuits.length > 0
                      ? ` · ${e.circuits.length} circuit${e.circuits.length > 1 ? "s" : ""}`
                      : ""}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PlaceCard({
  etape,
  etapes,
  troncons,
  nom,
  canEdit,
  canDelete,
  onEdit,
  onCenter,
  onSelect,
  onOpenTroncon,
  onDeleted,
}: {
  etape: EtapeItem;
  etapes: readonly EtapeItem[];
  troncons: readonly TronconItem[];
  nom: (id: string) => string;
  canEdit: boolean;
  canDelete: boolean;
  onEdit: () => void;
  onCenter: () => void;
  onSelect: (etape: EtapeItem) => void;
  onOpenTroncon: (id: string) => void;
  onDeleted: () => void;
}) {
  const relies = troncons.filter(
    (t) => t.etapeDepartId === etape.id || t.etapeArriveeId === etape.id,
  );
  const [copied, setCopied] = useState(false);
  const coordinates = `${etape.latitude.toFixed(6)}, ${etape.longitude.toFixed(6)}`;
  const nearby = etapes
    .filter((e) => e.id !== etape.id)
    .map((e) => ({ etape: e, km: haversineKm(etape, e) }))
    .sort((a, b) => a.km - b.km)
    .slice(0, 4);
  const osmUrl = `https://www.openstreetmap.org/?mlat=${etape.latitude}&mlon=${etape.longitude}#map=15/${etape.latitude}/${etape.longitude}`;

  const action = "flex w-16 flex-col items-center gap-1.5 text-[11px] font-medium text-gt-teal-800";
  const actionIcon =
    "grid size-10 place-items-center rounded-full bg-gt-teal-100 text-gt-teal-800 transition group-hover:bg-gt-teal-200";

  return (
    <article>
      <div className="relative h-40 overflow-hidden bg-gt-teal-100">
        {/* Vraie vue satellite du lieu (Esri World Imagery), à la place d'une photo. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={satellitePreviewUrl(etape.latitude, etape.longitude)}
          alt={`Vue satellite autour de ${etape.nom}`}
          className="size-full scale-125 object-cover"
        />
        <span className="absolute right-2 bottom-1 rounded bg-white/80 px-1 text-[9px] text-gt-teal-900">
          Imagerie © Esri, Maxar, Earthstar Geographics
        </span>
      </div>

      <div className="p-4">
        <h2 className="text-2xl font-semibold text-gt-teal-900">{etape.nom}</h2>
        <p className="mt-1 text-sm text-gt-teal-900/75">
          {TYPE_ETAPE_LABELS[etape.type]}
          {etape.altitudeM !== null ? ` · ${etape.altitudeM} m d'altitude` : ""}
        </p>

        <div className="mt-4 flex justify-between border-y border-gt-mist/60 py-4">
          <button type="button" onClick={onCenter} className={`group ${action}`}>
            <span className={actionIcon}>
              <Icon name="crosshair" className="size-5" />
            </span>
            Centrer
          </button>
          {canEdit ? (
            <button type="button" onClick={onEdit} className={`group ${action}`}>
              <span className={actionIcon}>
                <Icon name="pencil" className="size-5" />
              </span>
              Modifier
            </button>
          ) : null}
          <button
            type="button"
            onClick={async () => {
              await navigator.clipboard.writeText(coordinates);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
            className={`group ${action}`}
          >
            <span className={actionIcon}>
              <Icon name={copied ? "check" : "copy"} className="size-5" />
            </span>
            {copied ? "Copié" : "Coordonnées"}
          </button>
          <a href={osmUrl} target="_blank" rel="noreferrer" className={`group ${action}`}>
            <span className={actionIcon}>
              <Icon name="external" className="size-5" />
            </span>
            OSM
          </a>
        </div>

        {etape.description ? (
          <section className="mt-4">
            <h3 className="font-semibold text-gt-teal-900">En bref</h3>
            <p className="mt-1 text-sm leading-relaxed text-gt-teal-900/75">{etape.description}</p>
          </section>
        ) : null}

        <section className="mt-4">
          <h3 className="font-semibold text-gt-teal-900">Position</h3>
          <p className="mt-1 flex items-center gap-2 text-sm text-gt-teal-900/75">
            <Icon name="pin" className="size-4 text-gt-teal-700" />
            {coordinates}
          </p>
        </section>

        <section className="mt-4">
          <h3 className="font-semibold text-gt-teal-900">Circuits passant par ce lieu</h3>
          {etape.circuits.length === 0 ? (
            <p className="mt-1 text-sm text-gt-teal-900/75">Aucun circuit pour l&apos;instant.</p>
          ) : (
            <ul className="mt-2 space-y-1">
              {etape.circuits.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/dashboard/circuits/${c.id}`}
                    className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-gt-teal-800 hover:bg-gt-teal-50"
                  >
                    <Icon name="mountain" className="size-4" />
                    {c.titre}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-4">
          <h3 className="font-semibold text-gt-teal-900">Tronçons ({relies.length})</h3>
          {relies.length === 0 ? (
            <p className="mt-1 text-sm text-gt-teal-900/75">
              Aucun tronçon : ce lieu n&apos;est relié à aucun autre.
            </p>
          ) : (
            <ul className="mt-2 space-y-1">
              {relies.map((t) => {
                const autre = t.etapeDepartId === etape.id ? t.etapeArriveeId : t.etapeDepartId;
                return (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => onOpenTroncon(t.id)}
                      className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-gt-teal-50"
                    >
                      <span className="flex min-w-0 items-center gap-2 text-gt-teal-900">
                        <Icon name="route" className="size-4 shrink-0 text-gt-teal-700" />
                        <span className="truncate">{nom(autre)}</span>
                      </span>
                      <span className="shrink-0 text-xs text-gt-teal-900/75">
                        {formatKm(t.distanceKm)} · {formatDuree(t.dureeMinutes)}
                        {t.distanceEstimee ? " · estimé" : ""}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {nearby.length > 0 ? (
          <section className="mt-4">
            <h3 className="font-semibold text-gt-teal-900">À proximité</h3>
            <ul className="mt-2 space-y-1">
              {nearby.map(({ etape: e, km }) => (
                <li key={e.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(e)}
                    className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-gt-teal-50"
                  >
                    <span className="truncate text-gt-teal-900">{e.nom}</span>
                    <span className="shrink-0 text-xs text-gt-teal-900/75">
                      {km.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} km à vol
                      d&apos;oiseau
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {canDelete ? (
          <section className="mt-6 border-t border-gt-mist/60 pt-4">
            <DeleteButton
              id={etape.id}
              label="Supprimer l'étape"
              confirmMessage={`Supprimer l'étape « ${etape.nom} » ?`}
              action={async (input) => {
                const result = await deleteEtapeAction(input);
                if (!result.error) onDeleted();
                return result;
              }}
            />
            {etape.usages > 0 ? (
              <p className="mt-2 text-xs text-gt-teal-900/75">
                Utilisée par {etape.usages} élément(s) : la suppression sera refusée (RG 8).
              </p>
            ) : null}
          </section>
        ) : null}
      </div>
    </article>
  );
}
