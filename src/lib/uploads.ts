import "server-only";

import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";

import sharp, { type Sharp } from "sharp";

import { parseUploadUrl, type UploadKind, uploadUrl } from "@/lib/upload-paths";

/**
 * Images envoyées par les utilisateurs (photos de profil, logos, publications), stockées sur
 * le serveur dans `uploads/` (hors de git, hors de `public/`) et servies par la route
 * `/fichiers/…`.
 *
 * Sécurité et vie privée :
 * - 5 Mo au plus ; le fichier doit être une vraie image (décodée par sharp, sinon refus) ;
 * - l'image est RÉ-ENCODÉE en WebP : les métadonnées (EXIF, dont la POSITION GPS des photos
 *   prises au téléphone) ne sont pas recopiées ; l'orientation est appliquée avant ;
 * - taille limitée (pixels décodés plafonnés, image réduite) ; nom aléatoire.
 */

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const ALLOWED_FORMATS = new Set(["jpeg", "png", "webp", "gif", "heif", "avif"]);

export function uploadRoot(): string {
  return process.env.UPLOAD_DIR?.trim() || join(process.cwd(), "uploads");
}

const PRESETS: Record<UploadKind, (img: Sharp) => Sharp> = {
  // Photo de profil : carré 512 px.
  avatars: (img) => img.resize(512, 512, { fit: "cover" }).webp({ quality: 82 }),
  // Logo : contenu entier (transparence conservée), 512 px au plus.
  logos: (img) =>
    img.resize(512, 512, { fit: "inside", withoutEnlargement: true }).webp({ quality: 90 }),
  // Photo de publication : 1600 px au plus.
  publications: (img) =>
    img.resize(1600, 1600, { fit: "inside", withoutEnlargement: true }).webp({ quality: 80 }),
};

export class UploadError extends Error {}

/** Vérifie, nettoie et enregistre l'image ; renvoie son adresse « /fichiers/… ». */
export async function saveImage(data: Buffer, kind: UploadKind): Promise<string> {
  if (data.length === 0) throw new UploadError("Choisissez une image.");
  if (data.length > MAX_UPLOAD_BYTES) throw new UploadError("Image trop lourde (5 Mo au plus).");
  let output: Buffer;
  try {
    const image = sharp(data, { limitInputPixels: 50_000_000, failOn: "error" });
    const meta = await image.metadata();
    if (!meta.format || !ALLOWED_FORMATS.has(meta.format)) {
      throw new UploadError("Format non pris en charge (JPEG, PNG, WebP).");
    }
    // `rotate()` applique l'orientation EXIF ; les métadonnées ne sont pas recopiées.
    output = await PRESETS[kind](image.rotate()).toBuffer();
  } catch (error: unknown) {
    if (error instanceof UploadError) throw error;
    throw new UploadError("Ce fichier n'est pas une image lisible.");
  }
  const name = `${randomUUID()}.webp`;
  await mkdir(join(uploadRoot(), kind), { recursive: true });
  await writeFile(join(uploadRoot(), kind, name), output);
  return uploadUrl(kind, name);
}

/** Supprime une image envoyée (adresse « /fichiers/… ») ; ignore toute autre adresse. */
export async function deleteImage(url: string | null | undefined): Promise<void> {
  const parsed = parseUploadUrl(url);
  if (!parsed) return;
  await unlink(join(uploadRoot(), parsed.kind, parsed.name)).catch(() => undefined);
}

/** Contenu d'une image envoyée, ou null. */
export async function readImage(kind: UploadKind, name: string): Promise<Buffer | null> {
  try {
    return await readFile(join(uploadRoot(), kind, name));
  } catch {
    return null;
  }
}

/** Fichier reçu d'un formulaire (champ `File`) vers un Buffer, avec contrôle de taille. */
export async function fileToBuffer(file: unknown): Promise<Buffer> {
  if (!(file instanceof File) || file.size === 0) throw new UploadError("Choisissez une image.");
  if (file.size > MAX_UPLOAD_BYTES) throw new UploadError("Image trop lourde (5 Mo au plus).");
  return Buffer.from(await file.arrayBuffer());
}
