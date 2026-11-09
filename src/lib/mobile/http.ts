/** Réponses JSON de l'API mobile : données, ou `{ error }` avec le code HTTP adapté. */

export function json(data: unknown, init: { status?: number; private?: boolean } = {}) {
  return Response.json(data, {
    status: init.status ?? 200,
    // Données d'un voyageur : jamais mises en cache par un intermédiaire.
    headers: init.private ? { "Cache-Control": "private, no-store" } : undefined,
  });
}

export function jsonError(error: string, status: number) {
  return Response.json({ error }, { status, headers: { "Cache-Control": "no-store" } });
}

export const UNAUTHORIZED = () => jsonError("Session expirée : reconnectez-vous.", 401);
