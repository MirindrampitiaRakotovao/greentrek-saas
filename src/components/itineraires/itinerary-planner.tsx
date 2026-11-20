"use client";

import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore, useTransition } from "react";

import {
  type MapAltPath,
  type MapDot,
  type MapEdge,
  type MapMarker,
  MapView,
} from "@/components/map/map-view";
import { useNotify } from "@/components/ui/dialogs";
import { FormAlert } from "@/components/ui/form-alert";
import { Icon } from "@/components/ui/icon";
import { calculerItineraireAction } from "@/lib/actions/itineraires";
import {
  computeClientItineraireAction,
  proposeItineraireAction,
  requestItineraireAction,
} from "@/lib/actions/itineraires-perso";
import { MAX_FREE_WAYPOINTS } from "@/lib/graph/waypoints";
import { CRITERIA_LABELS, CRITERIA_PRESETS } from "@/lib/graph/weights";
import type { AlgorithmOutcome, VariantOutcome } from "@/lib/services/itineraires";
import type { Critere, ModeAlgorithme } from "@/lib/validators/itineraires";

/**
 * Page « Calculer un itinéraire » (§6.5), au style du panneau « Itinéraires » de Google Maps :
 * départ, arrivée, étapes imposées, critère ; tracé sur la carte et métriques.
 * Par défaut, vocabulaire simple (« meilleur itinéraire ») et calcul par A* (même résultat
 * optimal que Dijkstra, plus rapide). En mode expert : choix de l'algorithme, critère
 * personnalisé (α, β, γ), comparaison Dijkstra / A* et nœuds explorés sur la carte.
 */

export type PlannerEtape = { id: string; nom: string; latitude: number; longitude: number };
export type PlannerTroncon = { id: string; from: string; to: string; estime: boolean };

const ALGO_LABELS: Record<ModeAlgorithme, string> = {
  DIJKSTRA: "Dijkstra",
  ASTAR: "A*",
  COMPARER: "Comparer",
};

/** Couleurs des nœuds explorés : paire validée par script (teal / sable foncé). */
const EXPLORED_COLORS = { DIJKSTRA: "#c98a1b", ASTAR: "#00899e" } as const;

const fmtKm = (km: number) => `${km.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} km`;
const fmtDuree = (minutes: number) => {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return h > 0 ? `${h} h ${String(m).padStart(2, "0")}` : `${m} min`;
};
const fmtMs = (ms: number) => `${ms.toLocaleString("fr-FR", { maximumFractionDigits: 3 })} ms`;
const fmtCost = (cost: number | null) =>
  cost === null ? "—" : cost.toLocaleString("fr-FR", { maximumFractionDigits: 3 });

const DESKTOP_QUERY = "(min-width: 1024px)";
function useIsDesktop(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const media = window.matchMedia(DESKTOP_QUERY);
      media.addEventListener("change", onChange);
      return () => media.removeEventListener("change", onChange);
    },
    () => window.matchMedia(DESKTOP_QUERY).matches,
    () => true,
  );
}

export function ItineraryPlanner({
  etapes,
  troncons,
  expert = false,
  proposeTo,
  voyageur,
}: {
  expert?: boolean;
  /** Étape 4b : calcul par un voyageur sur le réseau de son agence, puis envoi à l'agence. */
  voyageur?: { agenceSlug: string };
  /** Composition d'un itinéraire pour un client (fiche client) : envoi après le calcul. */
  proposeTo?: { clientId: string; nom: string };
  etapes: readonly PlannerEtape[];
  troncons: readonly PlannerTroncon[];
}) {
  const [depart, setDepart] = useState("");
  const [arrivee, setArrivee] = useState("");
  const [imposees, setImposees] = useState<string[]>([]);
  const [ordreLibre, setOrdreLibre] = useState(false);
  const [critereChoisi, setCritere] = useState<Critere>("PLUS_COURT");
  // Le critère personnalisé n'existe qu'en mode expert.
  const critere: Critere =
    !expert && critereChoisi === "PERSONNALISE" ? "PLUS_COURT" : critereChoisi;
  const [coefs, setCoefs] = useState({ alpha: "1", beta: "0", gamma: "0" });
  const [algorithme, setAlgorithme] = useState<ModeAlgorithme>("COMPARER");
  const [outcomes, setOutcomes] = useState<AlgorithmOutcome[]>([]);
  const [showExplored, setShowExplored] = useState<"DIJKSTRA" | "ASTAR" | null>(null);
  /** Variante mise en avant (rang 2, 3…), ou null. */
  const [variante, setVariante] = useState<number | null>(null);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const isDesktop = useIsDesktop();

  const byId = new Map(etapes.map((e) => [e.id, e]));
  const nom = (id: string) => byId.get(id)?.nom ?? "?";
  const sorted = [...etapes].sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
  const found = outcomes.find((o) => o.found);
  // Tracés réels des tronçons (étape 6b-2), sinon lignes droites entre les étapes.
  const routePath =
    found && found.geometry.line.length > 1
      ? found.geometry.line
      : (found?.path.map((s) => [s.latitude, s.longitude] as [number, number]) ?? []);

  // Carte : départ (rouge), arrivée (orange), étapes imposées (numérotées), autres en retrait.
  const markers: MapMarker[] = etapes.map((e) => {
    const rang = imposees.indexOf(e.id);
    return {
      id: e.id,
      lat: e.latitude,
      lng: e.longitude,
      label: e.nom,
      badge:
        e.id === depart ? "D" : e.id === arrivee ? "A" : rang >= 0 ? String(rang + 1) : undefined,
      tone:
        e.id === depart ? "selected" : e.id === arrivee ? "new" : rang >= 0 ? "default" : "muted",
    };
  });
  const edges: MapEdge[] = troncons.flatMap((t) => {
    const a = byId.get(t.from);
    const b = byId.get(t.to);
    return a && b
      ? [
          {
            id: t.id,
            from: [a.latitude, a.longitude] as [number, number],
            to: [b.latitude, b.longitude] as [number, number],
            label: `${a.nom} – ${b.nom}`,
            dashed: t.estime,
            tone: "muted" as const,
          },
        ]
      : [];
  });
  // Variantes (étape 6b-3) : autres chemins réels, en corail sur la carte.
  const altPaths: MapAltPath[] = (found?.variantes ?? []).map((v) => ({
    id: String(v.rang),
    points:
      v.geometry.line.length > 1
        ? v.geometry.line
        : v.path.map((s) => [s.latitude, s.longitude] as [number, number]),
    label: `${v.rang}e itinéraire · ${fmtDuree(v.dureeMinutes)} (${fmtKm(v.distanceKm)})`,
    selected: variante === v.rang,
  }));
  const exploredOutcome = outcomes.find((o) => o.algorithme === showExplored);
  const dots: MapDot[] =
    exploredOutcome?.explored.flatMap((id, index) => {
      const e = byId.get(id);
      return e
        ? [
            {
              id: `${showExplored}-${id}`,
              lat: e.latitude,
              lng: e.longitude,
              color: EXPLORED_COLORS[exploredOutcome.algorithme],
              label: `${e.nom} : exploré en ${index + 1}e position (${exploredOutcome.algorithme === "ASTAR" ? "A*" : "Dijkstra"})`,
            },
          ]
        : [];
    }) ?? [];

  /** Clic sur une étape de la carte : remplit le départ, puis l'arrivée. */
  function pick(id: string) {
    if (!depart) setDepart(id);
    else if (!arrivee && id !== depart) setArrivee(id);
    else if (id !== depart && id !== arrivee && !imposees.includes(id))
      setImposees([...imposees, id]);
  }

  function move(index: number, delta: -1 | 1) {
    const next = [...imposees];
    const [item] = next.splice(index, 1);
    next.splice(index + delta, 0, item!);
    setImposees(next);
  }

  function calculer() {
    setError(undefined);
    startTransition(async () => {
      const preset = critere === "PERSONNALISE" ? null : CRITERIA_PRESETS[critere];
      const result = voyageur
        ? await computeClientItineraireAction({
            etapeDepartId: depart,
            etapeArriveeId: arrivee,
            etapesImposees: imposees,
            ordreLibre,
            critere,
          })
        : await calculerItineraireAction({
            etapeDepartId: depart,
            etapeArriveeId: arrivee,
            etapesImposees: imposees,
            ordreLibre,
            critere,
            alpha: preset ? preset.alpha : Number(coefs.alpha.replace(",", ".")),
            beta: preset ? preset.beta : Number(coefs.beta.replace(",", ".")),
            gamma: preset ? preset.gamma : Number(coefs.gamma.replace(",", ".")),
            // Hors mode expert : un seul calcul (A*), sans vocabulaire technique.
            algorithme: expert ? algorithme : "ASTAR",
          });
      if (result.error) {
        setError(Object.values(result.fieldErrors ?? {})[0] ?? result.error);
        setOutcomes([]);
        return;
      }
      const next = result.outcomes ?? [];
      setOutcomes(next);
      setVariante(null);
      setShowExplored(next.length > 1 ? "ASTAR" : null);
    });
  }

  const select =
    "w-full rounded-xl border border-gt-mist bg-white px-3 py-2.5 text-sm text-gt-teal-900 outline-none focus:border-gt-teal-600";
  const chip = (active: boolean) =>
    `rounded-full px-3 py-1.5 text-sm font-medium transition ${
      active ? "bg-gt-teal-700 text-white" : "bg-gt-teal-50 text-gt-teal-900 hover:bg-gt-teal-100"
    }`;

  return (
    <div className="relative flex flex-col overflow-hidden rounded-3xl border border-gt-mist/70 bg-white lg:block lg:h-[calc(100dvh-9.5rem)] lg:min-h-[640px]">
      <div className="relative h-[55vh] lg:absolute lg:inset-0 lg:h-auto">
        <MapView
          variant="satellite3d"
          markers={markers}
          edges={edges}
          path={routePath}
          pathStyle="route"
          altPaths={altPaths}
          onAltPathClick={(id) => setVariante(variante === Number(id) ? null : Number(id))}
          dots={dots}
          fitTo={routePath}
          fitKey={`${outcomes.map((o) => o.historiqueId ?? o.algorithme).join()}-${isDesktop}`}
          fitPadding={{ left: isDesktop ? 420 : 0 }}
          leftControlsClassName="left-3 lg:left-[444px]"
          onMarkerClick={pick}
          className="h-full"
        />
      </div>

      <aside
        aria-label="Calcul d'itinéraire"
        className="relative z-[1001] flex flex-col bg-white lg:absolute lg:top-3 lg:bottom-3 lg:left-3 lg:w-[420px] lg:overflow-hidden lg:rounded-2xl lg:shadow-xl"
      >
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
          {/* ── Départ / arrivée ── */}
          <div className="flex gap-3">
            <div className="flex flex-col items-center pt-9" aria-hidden="true">
              <span className="size-3 rounded-full border-2 border-[#d93025]" />
              <span className="my-1 w-px flex-1 border-l-2 border-dotted border-gt-mist" />
              <Icon name="pin" className="size-4 text-[#c98a1b]" />
            </div>
            <div className="flex-1 space-y-2">
              <label htmlFor="it-depart" className="block text-xs font-medium text-gt-teal-900/75">
                Départ
              </label>
              <select
                id="it-depart"
                value={depart}
                onChange={(e) => setDepart(e.target.value)}
                className={select}
              >
                <option value="">Choisir (ou cliquer sur la carte)…</option>
                {sorted.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.nom}
                  </option>
                ))}
              </select>
              <label htmlFor="it-arrivee" className="block text-xs font-medium text-gt-teal-900/75">
                Arrivée
              </label>
              <select
                id="it-arrivee"
                value={arrivee}
                onChange={(e) => setArrivee(e.target.value)}
                className={select}
              >
                <option value="">Choisir…</option>
                {sorted.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.nom}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={() => {
                setDepart(arrivee);
                setArrivee(depart);
              }}
              className="mt-16 grid size-9 place-items-center self-start rounded-full text-gt-teal-900 hover:bg-gt-teal-50"
              aria-label="Inverser départ et arrivée"
              title="Inverser"
            >
              <Icon name="swap" className="size-4" />
            </button>
          </div>

          {/* ── Étapes imposées ── */}
          <section aria-labelledby="it-imposees">
            <h2 id="it-imposees" className="text-sm font-semibold text-gt-teal-900">
              Étapes imposées {imposees.length > 0 ? `(${imposees.length})` : ""}
            </h2>
            {imposees.length > 0 ? (
              <ol className="mt-2 space-y-1">
                {imposees.map((id, index) => (
                  <li
                    key={id}
                    className="flex items-center gap-2 rounded-lg bg-gt-teal-50 px-2 py-1.5 text-sm"
                  >
                    <span className="grid size-6 place-items-center rounded-full bg-gt-teal-700 text-xs font-semibold text-white">
                      {index + 1}
                    </span>
                    <span className="flex-1 truncate">{nom(id)}</span>
                    {!ordreLibre ? (
                      <>
                        <button
                          type="button"
                          disabled={index === 0}
                          onClick={() => move(index, -1)}
                          aria-label={`Monter ${nom(id)}`}
                          className="rounded p-1 disabled:opacity-30"
                        >
                          <Icon name="arrowUp" className="size-4" />
                        </button>
                        <button
                          type="button"
                          disabled={index === imposees.length - 1}
                          onClick={() => move(index, 1)}
                          aria-label={`Descendre ${nom(id)}`}
                          className="rounded p-1 disabled:opacity-30"
                        >
                          <Icon name="arrowDown" className="size-4" />
                        </button>
                      </>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => setImposees(imposees.filter((x) => x !== id))}
                      aria-label={`Retirer ${nom(id)}`}
                      className="rounded p-1 text-red-700"
                    >
                      <Icon name="close" className="size-4" />
                    </button>
                  </li>
                ))}
              </ol>
            ) : null}
            <label htmlFor="it-ajout" className="sr-only">
              Ajouter une étape imposée
            </label>
            <select
              id="it-ajout"
              value=""
              onChange={(e) => e.target.value && setImposees([...imposees, e.target.value])}
              className={`${select} mt-2`}
            >
              <option value="">+ Ajouter une étape imposée…</option>
              {sorted
                .filter((e) => e.id !== depart && e.id !== arrivee && !imposees.includes(e.id))
                .map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.nom}
                  </option>
                ))}
            </select>
            <label className="mt-2 flex items-center gap-2 text-sm text-gt-teal-900">
              <input
                type="checkbox"
                checked={ordreLibre}
                onChange={(e) => setOrdreLibre(e.target.checked)}
                className="size-4 accent-gt-teal-700"
              />
              {expert
                ? `Ordre libre : trouver le meilleur ordre (Held-Karp, ${MAX_FREE_WAYPOINTS} étapes max)`
                : `Ordre libre : trouver le meilleur ordre de visite (${MAX_FREE_WAYPOINTS} étapes au plus)`}
            </label>
          </section>

          {/* ── Critère ── */}
          <section aria-labelledby="it-critere">
            <h2 id="it-critere" className="text-sm font-semibold text-gt-teal-900">
              Critère
            </h2>
            <div className="mt-2 flex flex-wrap gap-2">
              {(expert
                ? (["PLUS_COURT", "PLUS_RAPIDE", "PLUS_FACILE", "PERSONNALISE"] as const)
                : (["PLUS_COURT", "PLUS_RAPIDE", "PLUS_FACILE"] as const)
              ).map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-pressed={critere === c}
                  onClick={() => setCritere(c)}
                  className={chip(critere === c)}
                >
                  {CRITERIA_LABELS[c]}
                </button>
              ))}
            </div>
            {expert && critere === "PERSONNALISE" ? (
              <div className="mt-3 space-y-2 rounded-xl bg-gt-teal-50 p-3">
                <p className="text-xs text-gt-teal-900/75">
                  w = α · km + β · heures + γ · (difficulté − 1) · km
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {(["alpha", "beta", "gamma"] as const).map((k) => (
                    <label key={k} className="text-xs font-medium text-gt-teal-900">
                      {k === "alpha"
                        ? "α (distance)"
                        : k === "beta"
                          ? "β (durée)"
                          : "γ (difficulté)"}
                      <input
                        inputMode="decimal"
                        value={coefs[k]}
                        onChange={(e) => setCoefs({ ...coefs, [k]: e.target.value })}
                        className="mt-1 w-full rounded-lg border border-gt-mist bg-white px-2 py-1.5 text-sm"
                      />
                    </label>
                  ))}
                </div>
              </div>
            ) : expert && critere !== "PERSONNALISE" ? (
              <p className="mt-2 text-xs text-gt-teal-900/75">
                α = {CRITERIA_PRESETS[critere].alpha}, β = {CRITERIA_PRESETS[critere].beta}, γ ={" "}
                {CRITERIA_PRESETS[critere].gamma}
              </p>
            ) : null}
          </section>

          {/* ── Algorithme (mode expert) ── */}
          {expert ? (
            <section aria-labelledby="it-algo">
              <h2 id="it-algo" className="text-sm font-semibold text-gt-teal-900">
                Algorithme
              </h2>
              <div
                role="radiogroup"
                aria-labelledby="it-algo"
                className="mt-2 grid grid-cols-3 rounded-full bg-gt-teal-50 p-1"
              >
                {(["DIJKSTRA", "ASTAR", "COMPARER"] as const).map((a) => (
                  <button
                    key={a}
                    type="button"
                    role="radio"
                    aria-checked={algorithme === a}
                    onClick={() => setAlgorithme(a)}
                    className={`rounded-full py-2 text-sm font-medium ${algorithme === a ? "bg-white text-gt-teal-900 shadow-sm" : "text-gt-teal-900/75"}`}
                  >
                    {ALGO_LABELS[a]}
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          <button
            type="button"
            onClick={calculer}
            disabled={pending || !depart || !arrivee}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-gt-teal-700 px-5 py-3 font-medium text-white hover:bg-gt-teal-800 disabled:opacity-50"
          >
            <Icon name="navigation" className="size-4" />
            {pending
              ? "Calcul…"
              : !expert
                ? "Calculer le meilleur itinéraire"
                : algorithme === "COMPARER"
                  ? "Comparer Dijkstra et A*"
                  : "Calculer l'itinéraire"}
          </button>

          <FormAlert message={error} />
          <Results
            expert={expert}
            outcomes={outcomes}
            nom={nom}
            showExplored={showExplored}
            setShowExplored={setShowExplored}
            variante={variante}
            setVariante={setVariante}
            avecEtapesImposees={imposees.length > 0}
          />
          {proposeTo && found?.historiqueId ? (
            <ProposeForm
              key={found.historiqueId}
              client={proposeTo}
              historiqueId={found.historiqueId}
              defaultTitre={`${nom(found.path[0]?.id ?? "")} – ${nom(found.path.at(-1)?.id ?? "")}`}
            />
          ) : null}
          {voyageur && found?.historiqueId ? (
            <ProposeForm
              key={found.historiqueId}
              voyageur={voyageur}
              historiqueId={found.historiqueId}
              defaultTitre={`${nom(found.path[0]?.id ?? "")} – ${nom(found.path.at(-1)?.id ?? "")}`}
            />
          ) : null}
        </div>
      </aside>
    </div>
  );
}

/**
 * Envoi de l'itinéraire calculé (titre et message) : au client par l'agence (retour à sa
 * fiche), ou à l'agence par le voyageur (ouverture de sa demande).
 */
function ProposeForm({
  client,
  voyageur,
  historiqueId,
  defaultTitre,
}: {
  client?: { clientId: string; nom: string };
  voyageur?: { agenceSlug: string };
  historiqueId: string;
  defaultTitre: string;
}) {
  const router = useRouter();
  const notify = useNotify();
  const [titre, setTitre] = useState(defaultTitre);
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  function envoyer() {
    setError(undefined);
    startTransition(async () => {
      const result = client
        ? await proposeItineraireAction({ clientId: client.clientId, historiqueId, titre, message })
        : await requestItineraireAction({ historiqueId, titre, message });
      if (result.error) {
        setError(Object.values(result.fieldErrors ?? {})[0] ?? result.error);
        return;
      }
      if (result.success) notify(result.success);
      if (client) router.push(`/dashboard/clients/${client.clientId}`);
      else if (voyageur && "id" in result && typeof result.id === "string") {
        router.push(`/a/${voyageur.agenceSlug}/mon-compte/itineraires/${result.id}`);
      }
    });
  }

  return (
    <section
      aria-labelledby="it-envoi"
      className="space-y-3 rounded-2xl border border-gt-teal-700/30 bg-gt-teal-50 p-4"
    >
      <h2 id="it-envoi" className="text-sm font-semibold text-gt-teal-900">
        {client ? `Proposer cet itinéraire à ${client.nom}` : "Envoyer cet itinéraire à l'agence"}
      </h2>
      <label className="block text-xs font-medium text-gt-teal-900">
        Titre
        <input
          value={titre}
          onChange={(e) => setTitre(e.target.value)}
          maxLength={150}
          className="mt-1 w-full rounded-xl border border-gt-mist bg-white px-3 py-2 text-sm"
        />
      </label>
      <label className="block text-xs font-medium text-gt-teal-900">
        Message (facultatif)
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={3}
          maxLength={1000}
          placeholder={
            client
              ? "Points forts, conseils, période idéale…"
              : "Dates souhaitées, nombre de voyageurs, questions…"
          }
          className="mt-1 w-full rounded-xl border border-gt-mist bg-white px-3 py-2 text-sm"
        />
      </label>
      <FormAlert message={error} />
      <button
        type="button"
        onClick={envoyer}
        disabled={pending}
        className="flex w-full items-center justify-center gap-2 rounded-full bg-gt-teal-700 px-5 py-3 font-medium text-white hover:bg-gt-teal-800 disabled:opacity-50"
      >
        <Icon name="send" className="size-4" />
        {pending ? "Envoi…" : client ? `Envoyer à ${client.nom}` : "Envoyer à l'agence"}
      </button>
    </section>
  );
}

function Results({
  expert,
  outcomes,
  nom,
  showExplored,
  setShowExplored,
  variante,
  setVariante,
  avecEtapesImposees,
}: {
  expert: boolean;
  outcomes: readonly AlgorithmOutcome[];
  nom: (id: string) => string;
  showExplored: "DIJKSTRA" | "ASTAR" | null;
  setShowExplored: (value: "DIJKSTRA" | "ASTAR" | null) => void;
  variante: number | null;
  setVariante: (rang: number | null) => void;
  avecEtapesImposees: boolean;
}) {
  if (outcomes.length === 0) return null;
  const main = outcomes.find((o) => o.found);
  if (!main) {
    return (
      <p
        role="alert"
        className="rounded-xl border border-gt-sand-200 bg-gt-sand-200/40 px-3 py-3 text-sm text-gt-teal-900"
      >
        {outcomes[0]?.message ?? "Aucun itinéraire."}
      </p>
    );
  }
  const [d, a] = outcomes;
  const compare = outcomes.length === 2 && d && a;

  return (
    <div className="space-y-4 border-t border-gt-mist/60 pt-4">
      <div>
        <p className="text-2xl font-bold text-gt-teal-900">
          {fmtDuree(main.dureeMinutes)}{" "}
          <span className="text-base font-medium text-gt-teal-900/75">
            ({fmtKm(main.distanceKm)})
          </span>
        </p>
        <p className="text-sm text-gt-teal-900/75">
          Difficulté moyenne{" "}
          {main.difficulteMoyenne.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} / 5
          {expert ? ` · coût ${fmtCost(main.cost)}` : ""}
        </p>
        {main.order.length > 1 ? (
          <p className="mt-1 text-xs text-gt-teal-900/75">
            Ordre retenu : {main.order.map(nom).join(" → ")}
          </p>
        ) : null}
      </div>

      {!expert ? null : compare ? (
        <div>
          <h2 className="text-sm font-semibold text-gt-teal-900">Comparaison Dijkstra / A*</h2>
          <table className="mt-2 w-full text-left text-sm">
            <caption className="sr-only">Comparaison des deux algorithmes</caption>
            <thead className="text-xs text-gt-teal-900/75">
              <tr>
                <th scope="col" className="py-1 font-medium">
                  <span className="sr-only">Mesure</span>
                </th>
                <th scope="col" className="py-1 text-right font-medium">
                  Dijkstra
                </th>
                <th scope="col" className="py-1 text-right font-medium">
                  A*
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gt-mist/60">
              <tr>
                <th scope="row" className="py-1.5 font-normal text-gt-teal-900/75">
                  Coût
                </th>
                <td className="py-1.5 text-right">{fmtCost(d.cost)}</td>
                <td className="py-1.5 text-right">{fmtCost(a.cost)}</td>
              </tr>
              <tr>
                <th scope="row" className="py-1.5 font-normal text-gt-teal-900/75">
                  Nœuds explorés
                </th>
                <td className="py-1.5 text-right font-semibold">{d.exploredCount}</td>
                <td className="py-1.5 text-right font-semibold">{a.exploredCount}</td>
              </tr>
              <tr>
                <th scope="row" className="py-1.5 font-normal text-gt-teal-900/75">
                  Temps de calcul
                </th>
                <td className="py-1.5 text-right">{fmtMs(d.timeMs)}</td>
                <td className="py-1.5 text-right">{fmtMs(a.timeMs)}</td>
              </tr>
            </tbody>
          </table>
          {d.exploredCount > 0 ? (
            <p className="mt-2 text-xs text-gt-teal-900/75">
              Même coût optimal ; A* explore{" "}
              <strong>{Math.round((1 - a.exploredCount / d.exploredCount) * 100)} %</strong> de
              nœuds en moins. Sur un petit réseau, les temps sont de l&apos;ordre de la milliseconde
              : voir la page « Performances » pour les grands graphes.
            </p>
          ) : null}
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            <span className="text-gt-teal-900/75">Nœuds explorés sur la carte :</span>
            {(["DIJKSTRA", "ASTAR"] as const).map((algo) => (
              <button
                key={algo}
                type="button"
                aria-pressed={showExplored === algo}
                onClick={() => setShowExplored(showExplored === algo ? null : algo)}
                className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-medium ${showExplored === algo ? "border-gt-teal-700 bg-gt-teal-50" : "border-gt-mist"}`}
              >
                <span
                  aria-hidden="true"
                  className="size-2.5 rounded-full"
                  style={{ backgroundColor: EXPLORED_COLORS[algo] }}
                />
                {algo === "ASTAR" ? "A*" : "Dijkstra"}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <dl className="grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-xl bg-gt-teal-50 p-2.5">
            <dt className="text-xs text-gt-teal-900/75">Nœuds explorés</dt>
            <dd className="font-semibold">{main.exploredCount}</dd>
          </div>
          <div className="rounded-xl bg-gt-teal-50 p-2.5">
            <dt className="text-xs text-gt-teal-900/75">Temps de calcul</dt>
            <dd className="font-semibold">{fmtMs(main.timeMs)}</dd>
          </div>
        </dl>
      )}

      <div>
        <h2 className="text-sm font-semibold text-gt-teal-900">Étapes de l&apos;itinéraire</h2>
        <ol className="mt-2 space-y-0">
          {main.path.map((step, index) => (
            <li key={`${step.id}-${index}`} className="flex gap-3">
              <span className="flex flex-col items-center" aria-hidden="true">
                <span
                  className={`mt-1 size-3 rounded-full border-2 ${index === 0 ? "border-[#d93025]" : index === main.path.length - 1 ? "border-[#c98a1b] bg-[#c98a1b]" : "border-[#1a73e8]"}`}
                />
                {index < main.path.length - 1 ? (
                  <span className="w-0.5 flex-1 bg-[#1a73e8]/40" />
                ) : null}
              </span>
              <span className="pb-3 text-sm text-gt-teal-900">{step.nom}</span>
            </li>
          ))}
        </ol>
      </div>

      <Variantes
        main={main}
        expert={expert}
        variante={variante}
        setVariante={setVariante}
        avecEtapesImposees={avecEtapesImposees}
      />
    </div>
  );
}

const ecart = (value: number, format: (v: number) => string) =>
  value > 0 ? `+${format(value)}` : value < 0 ? `−${format(-value)}` : "identique";

/**
 * Autres itinéraires (étape 6b-3) : les 2e et 3e meilleurs chemins pour le critère choisi
 * (algorithme de Yen), avec l'écart au meilleur. Un clic les met en avant sur la carte.
 */
function Variantes({
  main,
  expert,
  variante,
  setVariante,
  avecEtapesImposees,
}: {
  main: AlgorithmOutcome;
  expert: boolean;
  variante: number | null;
  setVariante: (rang: number | null) => void;
  avecEtapesImposees: boolean;
}) {
  if (avecEtapesImposees) {
    return (
      <p className="text-xs text-gt-teal-900/75">
        Autres itinéraires : proposés seulement sans étape imposée.
      </p>
    );
  }
  const variantes: readonly VariantOutcome[] = main.variantes ?? [];
  return (
    <section aria-labelledby="it-variantes" className="space-y-2">
      <h2 id="it-variantes" className="text-sm font-semibold text-gt-teal-900">
        Autres itinéraires, moins avantageux
      </h2>
      {variantes.length === 0 ? (
        <p className="text-xs text-gt-teal-900/75">
          Aucun autre chemin : le réseau ne relie ces deux étapes que par cet itinéraire.
        </p>
      ) : (
        <ul className="space-y-2">
          {variantes.map((v) => {
            const active = variante === v.rang;
            return (
              <li key={v.rang}>
                <button
                  type="button"
                  onClick={() => setVariante(active ? null : v.rang)}
                  aria-pressed={active}
                  className={`w-full rounded-xl border px-3 py-2.5 text-left transition ${
                    active
                      ? "border-[#e8594a] bg-[#fff1ef]"
                      : "border-gt-mist hover:border-[#ff9f94] hover:bg-[#fff7f6]"
                  }`}
                >
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="flex items-center gap-2 text-sm font-semibold text-gt-teal-900">
                      <span
                        aria-hidden="true"
                        className={`h-0 w-5 border-t-[3px] border-[#e8594a] ${active ? "" : "border-dashed"}`}
                      />
                      {v.rang}e itinéraire · {fmtDuree(v.dureeMinutes)}
                    </span>
                    <span className="text-xs text-gt-teal-900/75">{fmtKm(v.distanceKm)}</span>
                  </span>
                  <span className="mt-0.5 block text-xs text-gt-teal-900/75">
                    {ecart(v.dureeMinutes - main.dureeMinutes, fmtDuree)} de marche ·{" "}
                    {ecart(Math.round((v.distanceKm - main.distanceKm) * 100) / 100, fmtKm)} ·
                    difficulté{" "}
                    {v.difficulteMoyenne.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} / 5
                    {expert ? ` · coût ${fmtCost(v.cost)}` : ""}
                  </span>
                  <span
                    className={`mt-1 block text-xs text-gt-teal-900 ${active ? "" : "line-clamp-1"}`}
                  >
                    {v.path.map((p) => p.nom).join(" → ")}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {expert ? (
        <p className="text-xs text-gt-teal-900/75">
          Calculés par l&apos;algorithme de Yen (k plus courts chemins sans boucle) : chaque
          variante est un vrai chemin du réseau, de coût supérieur ou égal au meilleur.
        </p>
      ) : null}
    </section>
  );
}
