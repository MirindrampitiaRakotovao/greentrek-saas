import { z } from "zod";

/*
 * Briques de validation partagées par les formulaires.
 *
 * Règle importante : chaque schéma est validé DEUX fois, dans le navigateur (React Hook
 * Form) puis sur le serveur (action), et le serveur reçoit les valeurs DÉJÀ transformées
 * par le navigateur (ex. "" devenu null, "12" devenu 12). Chaque brique doit donc accepter
 * aussi bien la saisie brute que sa forme transformée (validation idempotente).
 * Un test unitaire vérifie cette propriété pour tous les schémas de formulaire.
 */

/** Texte obligatoire, espaces retirés aux extrémités. */
export function requiredText(max: number, message = "Champ requis.") {
  return z
    .string()
    .trim()
    .min(1, { error: message })
    .max(max, { error: `${max} caractères au maximum.` });
}

/** Texte facultatif : chaîne vide ou null → null. */
export function optionalText(max: number) {
  return z
    .string()
    .trim()
    .max(max, { error: `${max} caractères au maximum.` })
    .nullable()
    .transform((value) => (value ? value : null));
}

/** Téléphone facultatif : chiffres, espaces et + ( ) . - ; vide → null. */
export const optionalPhone = z
  .string()
  .trim()
  .max(30, { error: "30 caractères au maximum." })
  .regex(/^[+0-9 ().-]*$/, { error: "Chiffres, espaces et + ( ) . - uniquement." })
  .nullable()
  .transform((value) => (value ? value : null));

/** E-mail facultatif, normalisé en minuscules ; vide → null. */
export const optionalEmail = z
  .string()
  .trim()
  .toLowerCase()
  .max(191)
  .nullable()
  .transform((value) => (value ? value : null))
  .pipe(z.email({ error: "Adresse e-mail invalide." }).nullable());

/** Adresse web facultative (http ou https) ; vide → null. */
export const optionalUrl = z
  .string()
  .trim()
  .max(500, { error: "500 caractères au maximum." })
  .nullable()
  .transform((value) => (value ? value : null))
  .pipe(
    z
      .url({ protocol: /^https?$/, error: "Adresse web invalide (http:// ou https://)." })
      .nullable(),
  );

/** Convertit une saisie numérique : "" / null → null ; "12,5" → 12.5 ; nombre inchangé. */
function toOptionalNumber(value: unknown): unknown {
  if (value === "" || value === null || value === undefined) return null;
  if (typeof value === "string") return Number(value.trim().replace(",", "."));
  return value;
}

/** Nombre facultatif, bornes incluses. */
export function optionalNumber(min: number, max: number, label = "La valeur") {
  return z.preprocess(
    toOptionalNumber,
    z
      .number({ error: "Nombre invalide." })
      .min(min, { error: `${label} doit être au moins ${min}.` })
      .max(max, { error: `${label} doit être au plus ${max}.` })
      .nullable(),
  );
}

/** Entier facultatif, bornes incluses. */
export function optionalInt(min: number, max: number, label = "La valeur") {
  return z.preprocess(
    toOptionalNumber,
    z
      .number({ error: "Nombre invalide." })
      .int({ error: "Nombre entier attendu." })
      .min(min, { error: `${label} doit être au moins ${min}.` })
      .max(max, { error: `${label} doit être au plus ${max}.` })
      .nullable(),
  );
}

/** Case à cocher : accepte booléen ou "on" (envoi HTML natif). */
export const checkbox = z.preprocess((value) => value === true || value === "on", z.boolean());

/** Groupe de cases à cocher : React Hook Form renvoie un tableau, `false` si rien n'est coché. */
export function checkboxGroup<const T extends readonly [string, ...string[]]>(values: T) {
  return z.preprocess(
    (value) => (Array.isArray(value) ? value : typeof value === "string" ? [value] : []),
    z.array(z.enum(values, { error: "Valeur invalide." })),
  );
}

/** Nombre obligatoire, bornes incluses (saisie texte convertie, virgule acceptée). */
export function requiredNumber(min: number, max: number, label = "La valeur") {
  return z.preprocess(
    (value) => {
      const converted = toOptionalNumber(value);
      return converted === null ? undefined : converted;
    },
    z
      .number({ error: `${label} est requise.` })
      .min(min, { error: `${label} doit être au moins ${min}.` })
      .max(max, { error: `${label} doit être au plus ${max}.` }),
  );
}

/** Entier obligatoire, bornes incluses. */
export function requiredInt(min: number, max: number, label = "La valeur") {
  return z.preprocess(
    (value) => {
      const converted = toOptionalNumber(value);
      return converted === null ? undefined : converted;
    },
    z
      .number({ error: `${label} est requise.` })
      .int({ error: "Nombre entier attendu." })
      .min(min, { error: `${label} doit être au moins ${min}.` })
      .max(max, { error: `${label} doit être au plus ${max}.` }),
  );
}
