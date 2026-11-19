"use server";

import { revalidatePath } from "next/cache";

import { authorize, journal } from "@/lib/actions/helpers";
import type { ActionResult } from "@/lib/actions/types";
import { getCurrentUser } from "@/lib/auth/session";
import { setAgencyLogo, setUserPhoto } from "@/lib/services/photos";
import { getTenantDb } from "@/lib/tenant";
import { deleteImage, fileToBuffer, saveImage, UploadError } from "@/lib/uploads";

/*
 * Photo de profil (tout compte d'une agence : personnel, guide, voyageur) et logo de l'agence
 * (administrateur). L'image est vérifiée, nettoyée (métadonnées et position GPS retirées) et
 * réduite par `saveImage` ; l'ancienne est supprimée du disque.
 */

async function withUpload(run: () => Promise<ActionResult>): Promise<ActionResult> {
  try {
    return await run();
  } catch (error: unknown) {
    if (error instanceof UploadError) return { error: error.message };
    throw error;
  }
}

/** Nouvelle photo de profil de l'utilisateur connecté (`FormData` : champ « photo »). */
export async function uploadMyPhotoAction(formData: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user?.agenceId) return { error: "Connectez-vous pour modifier votre photo." };
  return withUpload(async () => {
    const url = await saveImage(await fileToBuffer(formData.get("photo")), "avatars");
    const before = await setUserPhoto(getTenantDb(user.agenceId!), user.id, url);
    await deleteImage(before);
    revalidatePath("/", "layout");
    return { success: "Photo de profil enregistrée." };
  });
}

/** Retire la photo de profil de l'utilisateur connecté. */
export async function removeMyPhotoAction(): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user?.agenceId) return { error: "Connectez-vous pour modifier votre photo." };
  const before = await setUserPhoto(getTenantDb(user.agenceId), user.id, null);
  await deleteImage(before);
  revalidatePath("/", "layout");
  return { success: "Photo de profil retirée." };
}

/** Nouveau logo de l'agence (administrateur, `FormData` : champ « logo »). */
export async function uploadAgencyLogoAction(formData: FormData): Promise<ActionResult> {
  const auth = await authorize("modifier", "agence");
  if (!auth.ok) return auth.result;
  return withUpload(async () => {
    const url = await saveImage(await fileToBuffer(formData.get("logo")), "logos");
    const before = await setAgencyLogo(auth.db, auth.user.agenceId, url);
    await deleteImage(before);
    await journal(auth, "LOGO_MODIFIE", "Agence", auth.user.agenceId);
    revalidatePath("/", "layout");
    return { success: "Logo de l'agence enregistré." };
  });
}
