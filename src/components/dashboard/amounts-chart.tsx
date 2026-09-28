"use client";

import { useId, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { RANGE_LABELS, RANGES, type Range, type SeriesPoint } from "@/lib/dashboard/series";
import { formatMoney } from "@/lib/format";

/**
 * Courbe en aires (maquette : « Cashflow »). Règles de visualisation appliquées :
 * - UN SEUL axe vertical : les séries ont la même unité (montants de l'agence) ;
 * - couleurs validées par script (teal #00899E, sable #C98A1B) ; le sable ayant un contraste
 *   < 3:1, une légende, une infobulle au survol et un tableau accessible accompagnent le graphe ;
 * - traits de 2 px, grille discrète, texte dans les couleurs de texte (jamais celle de la série).
 */

export type SeriesDef<K extends string> = { key: K; label: string; color: string; area?: boolean };

const compact = new Intl.NumberFormat("fr-FR", { notation: "compact", maximumFractionDigits: 1 });

export function AmountsChart<K extends string>({
  data,
  series,
  devise,
  unit = "money",
  defaultRange = "30j",
  ranges = RANGES,
}: {
  data: Record<Range, SeriesPoint<K>[]> | Partial<Record<Range, SeriesPoint<K>[]>>;
  series: readonly SeriesDef<K>[];
  devise: string;
  unit?: "money" | "count";
  defaultRange?: Range;
  ranges?: readonly Range[];
}) {
  const [range, setRange] = useState<Range>(defaultRange);
  const selectId = useId();
  const points = data[range] ?? [];
  const format = (value: number) =>
    unit === "money" ? formatMoney(value, devise) : value.toLocaleString("fr-FR");
  const totals = series.map((s) => ({
    ...s,
    total: points.reduce((sum, point) => sum + (point[s.key] as number), 0),
  }));

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs text-gt-teal-900/60">
            Total {totals[0]?.label.toLocaleLowerCase("fr")} · {RANGE_LABELS[range]}
          </p>
          <p className="text-2xl font-bold tracking-tight text-gt-teal-900">
            {format(totals[0]?.total ?? 0)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <ul className="flex flex-wrap gap-4" aria-label="Légende">
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
          {ranges.length > 1 ? (
            <>
              <label htmlFor={selectId} className="sr-only">
                Période
              </label>
              <select
                id={selectId}
                value={range}
                onChange={(event) => setRange(event.target.value as Range)}
                className="rounded-full border border-gt-mist bg-white px-3 py-1.5 text-xs font-medium text-gt-teal-900"
              >
                {ranges.map((r) => (
                  <option key={r} value={r}>
                    {RANGE_LABELS[r]}
                  </option>
                ))}
              </select>
            </>
          ) : null}
        </div>
      </div>

      <div className="mt-4 h-60" aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <defs>
              {series.map((s) => (
                <linearGradient key={s.key} id={`fill-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={s.color} stopOpacity={0.28} />
                  <stop offset="100%" stopColor={s.color} stopOpacity={0.02} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid vertical={false} stroke="#d1d9da" strokeDasharray="3 3" />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11, fill: "#0f414d99" }}
              interval="preserveStartEnd"
              minTickGap={16}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={48}
              tick={{ fontSize: 11, fill: "#0f414d99" }}
              tickFormatter={(value: number) => compact.format(value)}
              allowDecimals={false}
            />
            <Tooltip
              cursor={{ stroke: "#0f414d", strokeDasharray: "3 3", strokeWidth: 1 }}
              content={(props) => (
                <ChartTooltip
                  active={props.active}
                  payload={props.payload}
                  label={props.label}
                  series={series}
                  format={format}
                />
              )}
            />
            {series.map((s) => (
              <Area
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.label}
                stroke={s.color}
                strokeWidth={2}
                fill={s.area === false ? "transparent" : `url(#fill-${s.key})`}
                activeDot={{ r: 5, strokeWidth: 2, stroke: "#ffffff" }}
                dot={false}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Vue tableau pour les lecteurs d'écran (identité jamais portée par la couleur seule).
          Masquée via une div : `sr-only` n'a pas d'effet sur un <table>, qui ignore largeur,
          hauteur et overflow (il allongeait la page). */}
      <div className="sr-only">
        <table>
          <caption>
            {series.map((s) => s.label).join(" et ")} — {RANGE_LABELS[range]}
          </caption>
          <thead>
            <tr>
              <th scope="col">Période</th>
              {series.map((s) => (
                <th key={s.key} scope="col">
                  {s.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {points.map((point) => (
              <tr key={point.key}>
                <th scope="row">{point.label}</th>
                {series.map((s) => (
                  <td key={s.key}>{format(point[s.key] as number)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

type TooltipEntry = { dataKey?: unknown; value?: unknown };

function ChartTooltip<K extends string>({
  active,
  payload,
  label,
  series,
  format,
}: {
  active?: boolean;
  payload?: readonly TooltipEntry[];
  label?: unknown;
  series: readonly SeriesDef<K>[];
  format: (value: number) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-gt-mist bg-white px-3 py-2 text-xs shadow-lg shadow-gt-teal-900/10">
      <p className="mb-1 font-semibold text-gt-teal-900">{String(label ?? "")}</p>
      {series.map((s) => {
        const entry = payload.find((item) => item.dataKey === s.key);
        return (
          <p key={s.key} className="flex items-center gap-1.5 text-gt-teal-900/80">
            <span
              aria-hidden="true"
              className="size-2 rounded-full"
              style={{ backgroundColor: s.color }}
            />
            {s.label} :{" "}
            <span className="font-semibold text-gt-teal-900">
              {format(Number(entry?.value ?? 0))}
            </span>
          </p>
        );
      })}
    </div>
  );
}
