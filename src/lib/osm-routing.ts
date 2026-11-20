import { type OsmRoute, parseOsrmRoute, type TracePoint } from "@/lib/graph/trace";

/**
 * Proposition de tracé (étape 6b-2) : chemin À PIED entre deux étapes, calculé par le service
 * public de trajets d'OpenStreetMap hébergé par l'association FOSSGIS (moteur OSRM, profil
 * piéton, gratuit, sans clé). Seules les coordonnées des deux étapes sont envoyées, jamais de
 * donnée personnelle ; l'application s'identifie par un nom générique. Usage modéré : un
 * appel à la fois, sur action de l'agence.
 */
export const OSM_FOOT_ROUTING = "https://routing.openstreetmap.de/routed-foot/route/v1/foot";
const USER_AGENT = "GreenTrekSaaS/1.0 (projet universitaire, ENI Fianarantsoa)";

export type FootRouteResult = { ok: true; route: OsmRoute } | { ok: false; error: string };

export async function fetchFootRoute(
  from: TracePoint,
  to: TracePoint,
  fetcher: typeof fetch = fetch,
  timeoutMs = 10_000,
): Promise<FootRouteResult> {
  const coords = `${from[0]},${from[1]};${to[0]},${to[1]}`;
  const url = `${OSM_FOOT_ROUTING}/${coords}?overview=full&geometries=geojson`;
  try {
    const response = await fetcher(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });
    if (response.status === 429) {
      return {
        ok: false,
        error: "Le service de trajets OSM est saturé : réessayez dans une minute.",
      };
    }
    const json: unknown = await response.json().catch(() => null);
    const route = parseOsrmRoute(json);
    if (!route) {
      return {
        ok: false,
        error: "OpenStreetMap ne connaît aucun chemin à pied entre ces deux étapes.",
      };
    }
    return { ok: true, route };
  } catch {
    return {
      ok: false,
      error: "Le service de trajets OSM ne répond pas (connexion Internet ?). Réessayez plus tard.",
    };
  }
}
