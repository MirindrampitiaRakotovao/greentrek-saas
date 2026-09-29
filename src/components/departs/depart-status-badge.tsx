import { Badge } from "@/components/ui/badge";
import type { StatutSession } from "@/generated/prisma/client";
import { STATUT_SESSION_LABELS } from "@/lib/validators/departs";

const TONES = {
  OUVERTE: "success",
  COMPLETE: "sand",
  ANNULEE: "danger",
  TERMINEE: "neutral",
} as const;

/** Statut d'un départ : le texte porte le sens, la couleur ne fait que le souligner. */
export function DepartStatusBadge({ statut }: { statut: StatutSession }) {
  return <Badge tone={TONES[statut]}>{STATUT_SESSION_LABELS[statut]}</Badge>;
}
