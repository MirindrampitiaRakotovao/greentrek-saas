/**
 * Réponses JSON de l'API mobile : données, ou `{ error }` avec le code HTTP adapté.
 *
 * CORS ouvert (`*`) : utile seulement à l'aperçu de l'application dans un navigateur (autre
 * port) ; l'application installée n'en a pas besoin. Sans risque ici : l'API n'utilise pas de
 * cookies (jeton explicite dans l'en-tête `Authorization`), donc une autre origine ne peut pas
 * agir au nom d'un voyageur.
 */
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

export function json(data: unknown, init: { status?: number; private?: boolean } = {}) {
  return Response.json(data, {
    status: init.status ?? 200,
    // Données d'un voyageur : jamais mises en cache par un intermédiaire.
    headers: init.private ? { ...CORS, "Cache-Control": "private, no-store" } : CORS,
  });
}

export function jsonError(error: string, status: number) {
  return Response.json({ error }, { status, headers: { ...CORS, "Cache-Control": "no-store" } });
}

export const UNAUTHORIZED = () => jsonError("Session expirée : reconnectez-vous.", 401);

/** Réponse aux requêtes préalables du navigateur (`OPTIONS`) : en-têtes CORS seuls. */
export function preflight() {
  return new Response(null, { status: 204, headers: CORS });
}
