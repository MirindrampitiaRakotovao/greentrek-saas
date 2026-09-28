/**
 * Résultat d'un service métier. Les refus prévus par les règles de gestion (e-mail déjà
 * utilisé, dernier administrateur…) sont renvoyés comme des valeurs, avec un message en
 * français à afficher, plutôt que levés comme des exceptions.
 */
export type ServiceResult<T = undefined> =
  { ok: true; data: T } | { ok: false; error: string; field?: string };

export function success<T>(data: T): ServiceResult<T> {
  return { ok: true, data };
}

export function failure(
  error: string,
  field?: string,
): { ok: false; error: string; field?: string } {
  return field ? { ok: false, error, field } : { ok: false, error };
}
