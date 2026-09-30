"use client";

import { useState, useTransition } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card } from "@/components/dashboard/widgets";
import { FormAlert } from "@/components/ui/form-alert";
import { Icon } from "@/components/ui/icon";
import { lancerBenchmarkAction } from "@/lib/actions/itineraires";
import { type BenchmarkRow, benchmarkToCsv } from "@/lib/graph/benchmark";
import { CRITERIA_LABELS } from "@/lib/graph/weights";

/**
 * Page « Analyse des performances » (§6.5) : banc d'essai sur graphes aléatoires de 50 à
 * 5 000 nœuds. Deux graphiques distincts (temps ; nœuds explorés) : jamais deux unités sur
 * un même axe. Couleurs validées par script ; légende, infobulle et tableau pour l'accès.
 */

const COLORS = { dijkstra: "#c98a1b", astar: "#00899e" } as const;
type Critere = "PLUS_COURT" | "PLUS_RAPIDE" | "PLUS_FACILE";

const fmt = (value: number, digits = 3) =>
  value.toLocaleString("fr-FR", { maximumFractionDigits: digits });

export function BenchmarkPanel() {
  const [critere, setCritere] = useState<Critere>("PLUS_COURT");
  const [rows, setRows] = useState<BenchmarkRow[]>([]);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  function run() {
    setError(undefined);
    startTransition(async () => {
      const result = await lancerBenchmarkAction({ critere });
      setError(result.error);
      setRows(result.rows ?? []);
    });
  }

  function download() {
    // BOM UTF-8 : Excel affiche correctement les accents.
    const blob = new Blob(["﻿", benchmarkToCsv(rows)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `benchmark-${critere.toLowerCase()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const chartData = rows.map((r) => ({
    taille: String(r.taille),
    dijkstraMs: r.dijkstraTempsMedianMs,
    astarMs: r.astarTempsMedianMs,
    dijkstraNoeuds: r.dijkstraNoeudsMoyens,
    astarNoeuds: r.astarNoeudsMoyens,
  }));

  return (
    <div className="space-y-5">
      <Card title="Banc d'essai">
        <p className="text-sm leading-relaxed text-gt-teal-900/75">
          Graphes aléatoires <strong>reproductibles</strong> (même graine, même graphe) de 50, 200,
          1 000 et 5 000 étapes, comparables à un réseau de sentiers (chaque lieu relié à ses
          voisins proches, distances = vol d&apos;oiseau × sinuosité). Pour chaque taille, 20 paires
          (départ, arrivée) sont tirées au hasard et les deux algorithmes sont mesurés sur les mêmes
          paires : médiane des temps, moyenne des nœuds explorés, et vérification que les coûts
          trouvés sont identiques.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {(["PLUS_COURT", "PLUS_RAPIDE", "PLUS_FACILE"] as const).map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={critere === c}
              onClick={() => setCritere(c)}
              className={`rounded-full px-3 py-1.5 text-sm font-medium ${critere === c ? "bg-gt-teal-700 text-white" : "bg-gt-teal-50 text-gt-teal-900 hover:bg-gt-teal-100"}`}
            >
              {CRITERIA_LABELS[c]}
            </button>
          ))}
          <button
            type="button"
            onClick={run}
            disabled={pending}
            className="ml-auto flex items-center gap-2 rounded-full bg-gt-teal-700 px-5 py-2.5 text-sm font-medium text-white hover:bg-gt-teal-800 disabled:opacity-60"
          >
            <Icon name="play" className="size-4" />
            {pending ? "Mesure en cours…" : "Lancer le banc d'essai"}
          </button>
          {rows.length > 0 ? (
            <button
              type="button"
              onClick={download}
              className="flex items-center gap-2 rounded-full border border-gt-teal-700 px-4 py-2.5 text-sm font-medium text-gt-teal-700 hover:bg-gt-teal-50"
            >
              <Icon name="download" className="size-4" />
              Exporter en CSV
            </button>
          ) : null}
        </div>
        <FormAlert message={error} />
      </Card>

      {rows.length > 0 ? (
        <>
          <div className="grid gap-5 xl:grid-cols-2">
            <Card title="Temps de calcul médian (ms)" className="min-w-0">
              <SeriesChart data={chartData} keys={["dijkstraMs", "astarMs"]} unit="ms" />
            </Card>
            <Card title="Nœuds explorés (moyenne)" className="min-w-0">
              <SeriesChart data={chartData} keys={["dijkstraNoeuds", "astarNoeuds"]} unit="nœuds" />
            </Card>
          </div>

          <Card title="Résultats détaillés">
            <div className="relative -mx-5 overflow-x-auto px-5">
              <table className="w-full min-w-[760px] text-right text-sm">
                <caption className="sr-only">Résultats du banc d&apos;essai</caption>
                <thead className="text-xs text-gt-teal-900/75">
                  <tr className="border-b border-gt-mist/70">
                    {[
                      "Étapes",
                      "Arcs",
                      "Dijkstra (ms)",
                      "A* (ms)",
                      "Nœuds Dijkstra",
                      "Nœuds A*",
                      "Réduction",
                      "Calibrage A* (ms)",
                      "Coûts identiques",
                    ].map((h) => (
                      <th
                        key={h}
                        scope="col"
                        className="py-2 pl-3 font-medium first:pl-0 first:text-left"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gt-mist/60">
                  {rows.map((r) => (
                    <tr key={r.taille}>
                      <th scope="row" className="py-2 text-left font-semibold">
                        {r.taille.toLocaleString("fr-FR")}
                      </th>
                      <td className="py-2 pl-3">{r.arcs.toLocaleString("fr-FR")}</td>
                      <td className="py-2 pl-3">{fmt(r.dijkstraTempsMedianMs)}</td>
                      <td className="py-2 pl-3">{fmt(r.astarTempsMedianMs)}</td>
                      <td className="py-2 pl-3">{fmt(r.dijkstraNoeudsMoyens, 0)}</td>
                      <td className="py-2 pl-3">{fmt(r.astarNoeudsMoyens, 0)}</td>
                      <td className="py-2 pl-3 font-semibold">−{fmt(r.reductionNoeudsPct, 0)} %</td>
                      <td className="py-2 pl-3">{fmt(r.calibrageAStarMs, 2)}</td>
                      <td className="py-2 pl-3">{r.coutsIdentiques ? "oui" : "NON"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-gt-teal-900/75">
              Le calibrage de l&apos;heuristique d&apos;A* (un prétraitement par graphe) est mesuré
              à part : il n&apos;est payé qu&apos;une fois, puis amorti sur les recherches
              suivantes. Les temps absolus dépendent de la machine ; les rapports entre algorithmes
              restent.
            </p>
          </Card>
        </>
      ) : null}
    </div>
  );
}

type ChartRow = { taille: string } & Record<
  "dijkstraMs" | "astarMs" | "dijkstraNoeuds" | "astarNoeuds",
  number
>;

function SeriesChart({
  data,
  keys,
  unit,
}: {
  data: ChartRow[];
  keys: readonly ["dijkstraMs", "astarMs"] | readonly ["dijkstraNoeuds", "astarNoeuds"];
  unit: string;
}) {
  const series = [
    { key: keys[0], label: "Dijkstra", color: COLORS.dijkstra },
    { key: keys[1], label: "A*", color: COLORS.astar },
  ];
  return (
    <div>
      <ul className="mb-2 flex gap-4" aria-label="Légende">
        {series.map((s) => (
          <li key={s.key} className="flex items-center gap-1.5 text-xs text-gt-teal-900/80">
            <span
              aria-hidden="true"
              className="size-2.5 rounded-full"
              style={{ backgroundColor: s.color }}
            />
            {s.label}
          </li>
        ))}
      </ul>
      <div className="h-64" aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
            <CartesianGrid vertical={false} stroke="#d1d9da" strokeDasharray="3 3" />
            <XAxis
              dataKey="taille"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11, fill: "#0f414d99" }}
              label={{
                value: "étapes",
                position: "insideBottomRight",
                offset: -2,
                fontSize: 11,
                fill: "#0f414d99",
              }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={48}
              tick={{ fontSize: 11, fill: "#0f414d99" }}
            />
            <Tooltip
              formatter={(value, name) => [`${fmt(Number(value))} ${unit}`, name]}
              labelFormatter={(label) => `${label} étapes`}
              contentStyle={{ borderRadius: 12, borderColor: "#d1d9da", fontSize: 12 }}
            />
            {series.map((s) => (
              <Line
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.label}
                stroke={s.color}
                strokeWidth={2}
                dot={{ r: 4, strokeWidth: 2, fill: "#fff" }}
                activeDot={{ r: 6 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
