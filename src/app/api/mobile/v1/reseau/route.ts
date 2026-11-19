import { json, preflight, UNAUTHORIZED } from "@/lib/mobile/http";
import { mobileClientFromRequest } from "@/lib/mobile/session";

/** Villages du réseau de l'agence du voyageur (pour composer son itinéraire, étape 4b). */
export async function GET(request: Request) {
  const ctx = await mobileClientFromRequest(request);
  if (!ctx) return UNAUTHORIZED();
  const etapes = await ctx.db.etape.findMany({
    select: { id: true, nom: true, type: true, latitude: true, longitude: true },
    orderBy: { nom: "asc" },
  });
  return json({ etapes }, { private: true });
}

export const OPTIONS = preflight;
