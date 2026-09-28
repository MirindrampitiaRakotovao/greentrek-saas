import { dayKey, MADAGASCAR_OFFSET_MS, monthKey, startOfDay, startOfMonth } from "@/lib/dates";

/**
 * Séries temporelles des graphiques du tableau de bord. Fonction PURE : elle reçoit des
 * montants datés et les regroupe par jour ou par mois (heure de Madagascar), en créant
 * aussi les périodes vides (valeur 0) pour que l'axe du temps soit continu.
 */

export const RANGES = ["7j", "30j", "12m"] as const;
export type Range = (typeof RANGES)[number];

export const RANGE_LABELS: Record<Range, string> = {
  "7j": "7 derniers jours",
  "30j": "30 derniers jours",
  "12m": "12 derniers mois",
};

export type SeriesPoint<K extends string> = { key: string; label: string } & Record<K, number>;

export type DatedAmount<K extends string> = { at: Date; series: K; amount: number };

const weekday = new Intl.DateTimeFormat("fr-FR", { weekday: "short", timeZone: "UTC" });
const shortDay = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "2-digit",
  timeZone: "UTC",
});
const shortMonth = new Intl.DateTimeFormat("fr-FR", { month: "short", timeZone: "UTC" });

/** Date « locale » (décalée de UTC+3) pour formater un libellé en UTC sans ambiguïté. */
function asLocal(date: Date): Date {
  return new Date(date.getTime() + MADAGASCAR_OFFSET_MS);
}

function buckets(range: Range, now: Date): { key: string; label: string }[] {
  if (range === "12m") {
    return Array.from({ length: 12 }, (_, i) => {
      const start = startOfMonth(now, i - 11);
      return { key: monthKey(start), label: shortMonth.format(asLocal(start)) };
    });
  }
  const days = range === "7j" ? 7 : 30;
  return Array.from({ length: days }, (_, i) => {
    const start = startOfDay(now, i - (days - 1));
    const label = range === "7j" ? weekday.format(asLocal(start)) : shortDay.format(asLocal(start));
    return { key: dayKey(start), label };
  });
}

/** Regroupe les montants par période ; les montants hors de la plage sont ignorés. */
export function buildSeries<K extends string>(
  amounts: readonly DatedAmount<K>[],
  seriesNames: readonly K[],
  range: Range,
  now: Date,
): SeriesPoint<K>[] {
  const points = buckets(range, now).map((bucket) => {
    const point = { key: bucket.key, label: bucket.label } as SeriesPoint<K>;
    for (const name of seriesNames) (point as Record<string, number | string>)[name] = 0;
    return point;
  });
  const byKey = new Map(points.map((point) => [point.key, point]));
  const keyOf = range === "12m" ? monthKey : dayKey;

  for (const { at, series, amount } of amounts) {
    const point = byKey.get(keyOf(at));
    if (point)
      (point as Record<string, number | string>)[series] = (point[series] as number) + amount;
  }
  return points;
}
