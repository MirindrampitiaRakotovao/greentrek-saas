/**
 * Chemins des fichiers envoyés par les utilisateurs (après E12) : fonctions pures, testées.
 * Un fichier est servi à l'adresse « /fichiers/<dossier>/<uuid>.webp ». Le nom est un UUID
 * aléatoire (impossible à deviner) et rien d'autre n'est accepté : pas de « .. », pas de
 * sous-dossier, pas d'autre extension (aucune traversée de répertoire possible).
 */
export const UPLOAD_KINDS = ["avatars", "logos", "publications"] as const;
export type UploadKind = (typeof UPLOAD_KINDS)[number];

const NAME = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$/;

export function isUploadKind(value: string): value is UploadKind {
  return (UPLOAD_KINDS as readonly string[]).includes(value);
}

export function isUploadName(value: string): boolean {
  return NAME.test(value);
}

export function uploadUrl(kind: UploadKind, name: string): string {
  return `/fichiers/${kind}/${name}`;
}

/** Dossier et nom d'une adresse « /fichiers/… » produite par l'application, sinon null. */
export function parseUploadUrl(
  url: string | null | undefined,
): { kind: UploadKind; name: string } | null {
  const m = url?.match(/^\/fichiers\/([a-z]+)\/([^/]+)$/);
  if (!m || !isUploadKind(m[1]!) || !isUploadName(m[2]!)) return null;
  return { kind: m[1]!, name: m[2]! };
}
