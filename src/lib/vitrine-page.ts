import { notFound } from "next/navigation";

import { calendarDate } from "@/lib/dates";
import { toIsoDate } from "@/lib/departs";
import { getVitrineAgency } from "@/lib/public-agency";
import { getTenantDb } from "@/lib/tenant";

/**
 * Point d'entrée des pages du site vitrine : agence du slug (404 si inconnue ou suspendue,
 * RG 19) et client confiné à cette agence. Aucune page publique n'utilise un autre client.
 */
export async function loadVitrine(slug: string) {
  const agence = await getVitrineAgency(slug);
  if (!agence) notFound();
  return {
    agence,
    db: getTenantDb(agence.id),
    /** « AAAA-MM-JJ » du jour à Madagascar (borne des champs date). */
    today: toIsoDate(calendarDate(new Date())),
  };
}
