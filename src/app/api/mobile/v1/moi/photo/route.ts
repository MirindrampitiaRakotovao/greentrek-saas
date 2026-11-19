import { json, jsonError, preflight, UNAUTHORIZED } from "@/lib/mobile/http";
import { mobileClientFromRequest, mobileProfile } from "@/lib/mobile/session";
import { setUserPhoto } from "@/lib/services/photos";
import { deleteImage, fileToBuffer, saveImage, UploadError } from "@/lib/uploads";

/**
 * Photo de profil du voyageur (formulaire multipart, champ « photo »). Même traitement que
 * le site : image vérifiée, réduite, métadonnées et position GPS retirées.
 */
export async function POST(request: Request) {
  const ctx = await mobileClientFromRequest(request);
  if (!ctx) return UNAUTHORIZED();
  const form = await request.formData().catch(() => null);
  if (!form) return jsonError("Choisissez une image.", 400);
  try {
    const url = await saveImage(await fileToBuffer(form.get("photo")), "avatars");
    await deleteImage(await setUserPhoto(ctx.db, ctx.user.id, url));
  } catch (error: unknown) {
    if (error instanceof UploadError) return jsonError(error.message, 422);
    throw error;
  }
  return json(await mobileProfile(ctx.user.id), { private: true });
}

/** Retire la photo de profil. */
export async function DELETE(request: Request) {
  const ctx = await mobileClientFromRequest(request);
  if (!ctx) return UNAUTHORIZED();
  await deleteImage(await setUserPhoto(ctx.db, ctx.user.id, null));
  return json(await mobileProfile(ctx.user.id), { private: true });
}

export const OPTIONS = preflight;
