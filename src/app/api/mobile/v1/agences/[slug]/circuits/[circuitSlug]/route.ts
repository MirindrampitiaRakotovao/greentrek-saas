import { getAdminDb } from "@/lib/admin-db";
import { json, jsonError } from "@/lib/mobile/http";
import { getCatalogueCircuit } from "@/lib/services/catalogue";

/** Fiche d'un circuit publié (étapes, tracé, départs, partenaires, avis publiés). */
export async function GET(
  _request: Request,
  { params }: RouteContext<"/api/mobile/v1/agences/[slug]/circuits/[circuitSlug]">,
) {
  const { slug, circuitSlug } = await params;
  const circuit = await getCatalogueCircuit(getAdminDb(), slug, circuitSlug);
  return circuit ? json(circuit) : jsonError("Circuit introuvable.", 404);
}
