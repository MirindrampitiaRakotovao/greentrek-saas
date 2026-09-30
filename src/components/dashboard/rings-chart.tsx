"use client";

import { PolarAngleAxis, RadialBar, RadialBarChart, ResponsiveContainer, Tooltip } from "recharts";

/**
 * Anneaux concentriques (maquette : « Expense Breakdown »). Chaque anneau = une catégorie,
 * rempli selon sa part du total. Chaque catégorie est aussi listée avec son libellé, sa valeur
 * et son pourcentage : l'information n'est jamais portée par la couleur seule.
 */
export type RingItem = { label: string; value: number; color: string };

export function RingsChart({
  items,
  totalLabel,
  totalValue,
}: {
  items: readonly RingItem[];
  totalLabel: string;
  totalValue: string;
}) {
  const total = items.reduce((sum, item) => sum + item.value, 0);
  // Recharts dessine le premier élément au centre : on inverse pour avoir le premier à l'extérieur.
  const data = [...items].reverse().map((item) => ({ ...item, fill: item.color }));

  return (
    <div>
      <div className="relative mx-auto h-52 max-w-[240px]" aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart
            data={data}
            innerRadius="32%"
            outerRadius="100%"
            startAngle={90}
            endAngle={-270}
            barSize={10}
          >
            <PolarAngleAxis type="number" domain={[0, Math.max(total, 1)]} tick={false} />
            <RadialBar dataKey="value" background={{ fill: "#dcefef" }} cornerRadius={8} />
            <Tooltip
              cursor={false}
              formatter={(value, _name, entry) => [
                `${value} (${total > 0 ? Math.round((Number(value) / total) * 100) : 0} %)`,
                (entry.payload as RingItem).label,
              ]}
              contentStyle={{ borderRadius: 12, borderColor: "#d1d9da", fontSize: 12 }}
            />
          </RadialBarChart>
        </ResponsiveContainer>
      </div>

      <p className="mt-3 text-xs text-gt-teal-900/75">{totalLabel}</p>
      <p className="text-2xl font-bold tracking-tight text-gt-teal-900">{totalValue}</p>

      <ul className="mt-4 space-y-3">
        {items.map((item) => {
          const percent = total > 0 ? Math.round((item.value / total) * 100) : 0;
          return (
            <li key={item.label} className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2.5 text-sm text-gt-teal-900">
                <span
                  aria-hidden="true"
                  className="size-2.5 rounded-sm"
                  style={{ backgroundColor: item.color }}
                />
                <span>
                  {item.label}
                  <span className="block text-xs text-gt-teal-900/75">{item.value}</span>
                </span>
              </span>
              <span className="rounded-lg bg-gt-teal-100 px-2 py-1 text-xs font-semibold text-gt-teal-900">
                {percent} %
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
