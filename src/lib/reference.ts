import { randomInt } from "node:crypto";

/**
 * Référence lisible d'une réservation (§5.2 : unique), par exemple « GTM-2026-4F7K2Q » :
 * initiales de l'agence, année, puis 6 caractères tirés au hasard. Alphabet sans caractères
 * ambigus (pas de 0/O, 1/I/L) : la référence se dicte au téléphone sans erreur.
 * 31^6 ≈ 887 millions de combinaisons par agence et par année ; l'index unique de la base
 * tranche en cas de collision (nouvel essai).
 */
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/** Initiales du slug de l'agence, en majuscules (« green-trek-mada » → « GTM »), 3 au plus. */
export function referencePrefix(agenceSlug: string): string {
  const initials = agenceSlug
    .split("-")
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")
    .slice(0, 3);
  return initials || "RES";
}

export function generateReference(
  prefix: string,
  year: number,
  random: (max: number) => number = randomInt,
): string {
  let code = "";
  for (let i = 0; i < 6; i += 1) code += ALPHABET[random(ALPHABET.length)];
  return `${prefix}-${year}-${code}`;
}
