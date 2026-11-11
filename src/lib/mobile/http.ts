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
  "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
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

/**
 * Entrée invalide (Zod) : 400 et erreurs par champ. Le chemin complet est conservé
 * (« participants.1.prenom ») pour que l'application place l'erreur sous le bon champ.
 */
export function validationError(issues: readonly { path: PropertyKey[]; message: string }[]) {
  const fieldErrors: Record<string, string> = {};
  for (const issue of issues) {
    const field = issue.path.map(String).join(".") || "form";
    fieldErrors[field] ??= issue.message;
  }
  return Response.json(
    { error: "Certains champs sont invalides.", fieldErrors },
    { status: 400, headers: { ...CORS, "Cache-Control": "no-store" } },
  );
}

/** Refus d'une règle de gestion (service) : 422, avec le champ concerné s'il est connu. */
export function businessError(error: string, field?: string) {
  return Response.json(
    { error, ...(field ? { fieldErrors: { [field]: error } } : {}) },
    { status: 422, headers: { ...CORS, "Cache-Control": "no-store" } },
  );
}

/** Corps JSON de la requête (null s'il est absent ou illisible : la validation le refusera). */
export async function readJson(request: Request): Promise<unknown> {
  return request.json().catch(() => null);
}

export const UNAUTHORIZED = () => jsonError("Session expirée : reconnectez-vous.", 401);

/** Réponse aux requêtes préalables du navigateur (`OPTIONS`) : en-têtes CORS seuls. */
export function preflight() {
  return new Response(null, { status: 204, headers: CORS });
}
