import { getAdminDb } from "@/lib/admin-db";
import { json } from "@/lib/mobile/http";
import { listCatalogue } from "@/lib/services/catalogue";
import { catalogueQuerySchema } from "@/lib/validators/mobile";

/**
 * Catalogue public de l'application mobile : circuits publiés de toutes les agences actives,
 * avec les filtres du site vitrine (`date`, `voyageurs`, `difficulte`) et `q` (texte libre).
 * Lecture seule, sans compte ; chaque agence est lue par son client confiné (service).
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const query = catalogueQuerySchema.parse({
    q: params.get("q") || undefined,
    date: params.get("date") || undefined,
    voyageurs: params.get("voyageurs") || undefined,
    difficulte: params.get("difficulte") || undefined,
  });
  return json(await listCatalogue(getAdminDb(), query));
}
