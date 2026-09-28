import type { ReactNode } from "react";

const TONES = {
  neutral: "bg-gt-mist/60 text-gt-teal-900",
  teal: "bg-gt-teal-700/10 text-gt-teal-800",
  sand: "bg-gt-sand-200 text-gt-teal-900",
  success: "bg-emerald-100 text-emerald-900",
  danger: "bg-red-100 text-red-900",
} as const;

/** Pastille de statut. Le texte porte le sens (pas seulement la couleur, accessibilité). */
export function Badge({
  tone = "neutral",
  children,
}: {
  tone?: keyof typeof TONES;
  children: ReactNode;
}) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${TONES[tone]}`}>
      {children}
    </span>
  );
}
