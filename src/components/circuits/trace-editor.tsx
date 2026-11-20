"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { useConfirm, useNotify } from "@/components/ui/dialogs";
import { Icon } from "@/components/ui/icon";
import {
  clearTraceAction,
  proposeAndSaveTraceAction,
  proposeTraceAction,
  refreshNetworkAction,
  saveTraceAction,
} from "@/lib/actions/troncon-traces";
import { roundedLengthKm, simplifyTrace, type TracePoint } from "@/lib/graph/trace";

/**
 * Tracé réel d'un tronçon (étape 6b-2) : proposition d'OpenStreetMap à valider, dessin ou
 * correction à la main sur la carte, effacement ; et « Proposer tous les tracés ».
 * Le tracé en cours (`TraceDraft`) est affiché et édité par la carte du réseau.
 */

export type TraceDraft = {
  tronconId: string;
  /** Points [latitude, longitude] (ordre de la carte). */
  points: [number, number][];
  source: "OSM" | "MANUEL";
  editable: boolean;
  /** Proposition d'OSM : distance entre chaque étape et le premier chemin connu (m). */
  accrocheM?: [number, number];
};

export type TraceTroncon = {
  id: string;
  distanceKm: number;
  distanceEstimee: boolean;
  trace: TracePoint[] | null;
  traceSource: "OSM" | "MANUEL" | null;
  depart: { nom: string; latitude: number; longitude: number };
  arrivee: { nom: string; latitude: number; longitude: number };
};

const km = (value: number) => `${value.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} km`;
const toLatLng = ([lng, lat]: TracePoint): [number, number] => [lat, lng];
const toLngLat = ([lat, lng]: [number, number]): TracePoint => [lng, lat];

/** Tolérance de simplification pour éditer un long tracé OSM à la main. */
const EDIT_TOLERANCE_M = 8;

/** La distance du tronçon est-elle la longueur de son tracé (« mesurée sur le tracé ») ? */
export function measuredOnTrace(t: Pick<TraceTroncon, "distanceKm" | "trace">): boolean {
  return (
    t.trace !== null &&
    t.trace.length > 1 &&
    Math.abs(roundedLengthKm(t.trace) - t.distanceKm) < 0.011
  );
}

export function TraceSection({
  troncon,
  draft,
  setDraft,
}: {
  troncon: TraceTroncon;
  draft: TraceDraft | null;
  setDraft: (draft: TraceDraft | null) => void;
}) {
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const [remplacer, setRemplacer] = useState(troncon.distanceEstimee);
  const confirm = useConfirm();
  const notify = useNotify();
  const mine = draft && draft.tronconId === troncon.id ? draft : null;

  function propose() {
    setError(undefined);
    startTransition(async () => {
      const result = await proposeTraceAction({ tronconId: troncon.id });
      if (result.error || !result.proposal) {
        setError(result.error ?? "Aucune proposition.");
        return;
      }
      setRemplacer(troncon.distanceEstimee);
      setDraft({
        tronconId: troncon.id,
        points: result.proposal.trace.map(toLatLng),
        source: "OSM",
        editable: false,
        accrocheM: result.proposal.accrocheM,
      });
    });
  }

  function drawByHand() {
    setError(undefined);
    const base: TracePoint[] = mine?.points.map(toLngLat) ??
      troncon.trace ?? [
        [troncon.depart.longitude, troncon.depart.latitude],
        [troncon.arrivee.longitude, troncon.arrivee.latitude],
      ];
    setDraft({
      tronconId: troncon.id,
      points: simplifyTrace(base, EDIT_TOLERANCE_M).map(toLatLng),
      source: "MANUEL",
      editable: true,
    });
  }

  function save() {
    if (!mine) return;
    setError(undefined);
    startTransition(async () => {
      const result = await saveTraceAction({
        tronconId: troncon.id,
        trace: mine.points.map(toLngLat),
        source: mine.source,
        remplacerDistance: remplacer,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      setDraft(null);
      if (result.success) notify(result.success);
    });
  }

  async function clear() {
    const ok = await confirm({
      title: "Effacer le tracé ?",
      message:
        "La carte reliera de nouveau les deux étapes en ligne droite. La distance du tronçon ne change pas.",
      confirmLabel: "Effacer",
      cancelLabel: "Retour",
      tone: "danger",
      icon: "trash",
    });
    if (!ok) return;
    setError(undefined);
    startTransition(async () => {
      const result = await clearTraceAction({ tronconId: troncon.id });
      if (result.error) setError(result.error);
      else if (result.success) notify(result.success);
    });
  }

  const button =
    "flex items-center justify-center gap-1.5 rounded-full border border-gt-teal-700 px-3 py-2 text-sm font-medium text-gt-teal-700 hover:bg-gt-teal-50 disabled:opacity-60";

  return (
    <section
      aria-labelledby="titre-trace"
      className="mt-5 space-y-3 rounded-2xl border border-gt-mist/80 p-4"
    >
      <h3 id="titre-trace" className="flex items-center gap-2 font-semibold text-gt-teal-900">
        <Icon name="route" className="size-4" />
        Tracé du sentier
      </h3>

      {mine ? (
        <>
          {mine.editable ? (
            <p className="text-sm text-gt-teal-900/80">
              Sur la carte : <strong>cliquez</strong> pour ajouter un point (inséré dans le segment
              le plus proche), <strong>faites glisser</strong> un point pour le déplacer,{" "}
              <strong>double-cliquez</strong> pour le supprimer. Les extrémités restent sur les
              étapes.
            </p>
          ) : (
            <p className="text-sm text-gt-teal-900/80">
              Proposition d&apos;OpenStreetMap (en orange sur la carte), par les chemins connus.
            </p>
          )}
          <p className="rounded-xl bg-gt-teal-50 px-3 py-2 text-sm text-gt-teal-900">
            <strong>{km(roundedLengthKm(mine.points.map(toLngLat)))}</strong> par ce tracé ·
            distance actuelle {km(troncon.distanceKm)}
            {troncon.distanceEstimee ? " (estimée)" : " (mesurée)"}
          </p>
          {mine.accrocheM
            ? mine.accrocheM.map((m, i) =>
                m > 300 ? (
                  <p key={i} className="text-xs text-amber-800">
                    Le chemin connu le plus proche de «{" "}
                    {i === 0 ? troncon.depart.nom : troncon.arrivee.nom} » est à{" "}
                    {m.toLocaleString("fr-FR")} m : ce morceau est relié en ligne droite.
                    Corrigez-le à la main si vous connaissez le sentier.
                  </p>
                ) : null,
              )
            : null}
          <label className="flex items-start gap-2 text-sm text-gt-teal-900">
            <input
              type="checkbox"
              checked={remplacer}
              onChange={(e) => setRemplacer(e.target.checked)}
              className="mt-0.5 size-4 accent-gt-teal-700"
            />
            <span>
              Remplacer la distance par la longueur du tracé
              <span className="block text-xs text-gt-teal-900/70">
                La durée est recalculée (règle de Naismith). Le tronçon reste « estimé » : ce
                n&apos;est pas un relevé de terrain.
              </span>
            </span>
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={save}
              disabled={pending || mine.points.length < 2}
              className="rounded-full bg-gt-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-gt-teal-800 disabled:opacity-60"
            >
              {pending ? "Enregistrement…" : "Enregistrer le tracé"}
            </button>
            {!mine.editable ? (
              <button type="button" onClick={drawByHand} className={button}>
                <Icon name="pencil" className="size-4" />
                Corriger à la main
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setDraft(null)}
              className="px-2 text-sm font-medium text-gt-teal-700 underline"
            >
              Annuler
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="text-sm text-gt-teal-900/80">
            {troncon.trace && troncon.traceSource
              ? `${troncon.traceSource === "OSM" ? "Tracé d'OpenStreetMap validé" : "Tracé dessiné à la main"} · ${km(roundedLengthKm(troncon.trace))}${measuredOnTrace(troncon) ? " · distance mesurée sur le tracé" : ""}.`
              : "Aucun tracé : la carte relie les deux étapes en ligne droite."}
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={propose} disabled={pending} className={button}>
              <Icon name="navigation" className="size-4" />
              {pending ? "Recherche…" : "Proposer le tracé (OSM)"}
            </button>
            <button type="button" onClick={drawByHand} disabled={pending} className={button}>
              <Icon name="pencil" className="size-4" />
              {troncon.trace ? "Modifier à la main" : "Dessiner à la main"}
            </button>
            {troncon.trace ? (
              <button
                type="button"
                onClick={clear}
                disabled={pending}
                className="px-2 text-sm font-medium text-red-700 underline disabled:opacity-60"
              >
                Effacer
              </button>
            ) : null}
          </div>
        </>
      )}
      {error ? (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      ) : null}
    </section>
  );
}

/** Pause entre deux demandes : usage modéré du service gratuit d'OpenStreetMap. */
const PAUSE_MS = 1000;

/**
 * « Proposer tous les tracés » : enregistre le tracé OSM de chaque tronçon qui n'en a pas,
 * un par un. Les distances estimées sont remplacées par la longueur du tracé ; une mesure de
 * terrain est gardée.
 */
export function BulkTraceButton({
  troncons,
  label,
}: {
  troncons: readonly { id: string; traceSource: string | null; label: string }[];
  label?: string;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [report, setReport] = useState<{ ok: number; failed: string[] } | null>(null);
  const todo = troncons.filter((t) => !t.traceSource);
  if (todo.length === 0 && !report) return null;

  async function run() {
    const ok = await confirm({
      title: `Proposer ${todo.length} tracé${todo.length > 1 ? "s" : ""} ?`,
      message: `OpenStreetMap propose le chemin à pied de chaque tronçon sans tracé (environ ${todo.length} secondes). Les tracés sont enregistrés ; les distances estimées sont remplacées par leur longueur, les mesures de terrain sont gardées. Vous pourrez corriger ou effacer chaque tracé.`,
      confirmLabel: "Proposer",
      cancelLabel: "Retour",
    });
    if (!ok) return;
    setReport(null);
    let done = 0;
    let saved = 0;
    const failed: string[] = [];
    setProgress({ done, total: todo.length });
    for (const t of todo) {
      const result = await proposeAndSaveTraceAction({ tronconId: t.id });
      if (result.error) failed.push(`${t.label} : ${result.error}`);
      else if (result.status === "enregistre") saved++;
      done++;
      setProgress({ done, total: todo.length });
      if (done < todo.length) await new Promise((r) => setTimeout(r, PAUSE_MS));
    }
    await refreshNetworkAction();
    router.refresh();
    setProgress(null);
    setReport({ ok: saved, failed });
  }

  return (
    <div className="space-y-2">
      {todo.length > 0 ? (
        <button
          type="button"
          onClick={run}
          disabled={progress !== null}
          className="flex w-full items-center justify-center gap-2 rounded-full border border-gt-teal-700 px-4 py-2 text-sm font-medium text-gt-teal-700 hover:bg-gt-teal-50 disabled:opacity-70"
        >
          <Icon name="route" className="size-4" />
          {progress
            ? `Tracés : ${progress.done} / ${progress.total}…`
            : (label ?? `Proposer tous les tracés (${todo.length} sans tracé)`)}
        </button>
      ) : null}
      {report ? (
        <div role="status" className="rounded-xl bg-gt-teal-50 px-3 py-2 text-xs text-gt-teal-900">
          {report.ok} tracé{report.ok > 1 ? "s" : ""} enregistré{report.ok > 1 ? "s" : ""}.
          {report.failed.length > 0 ? (
            <ul className="mt-1 list-disc pl-4 text-amber-800">
              {report.failed.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
