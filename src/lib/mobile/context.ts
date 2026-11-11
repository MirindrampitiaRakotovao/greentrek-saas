import type { TenantDb } from "@/lib/tenant";

/** Agence du voyageur connecté, telle que l'application l'affiche. */
export function currentAgence(db: TenantDb) {
  return db.agence.findFirstOrThrow({ select: { slug: true, nom: true, devise: true } });
}
