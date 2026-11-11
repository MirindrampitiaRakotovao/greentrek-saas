"use server";

import { redirect } from "next/navigation";

import { zodFieldErrors } from "@/lib/actions/helpers";
import type { ActionResult } from "@/lib/actions/types";
import { getAdminDb } from "@/lib/admin-db";
import { RESET_SENT, sendPasswordResetLink } from "@/lib/mail/password-reset";
import { resetPassword } from "@/lib/services/mot-de-passe";
import { forgotPasswordSchema, resetPasswordSchema } from "@/lib/validators/auth";

/* « Mot de passe oublié » (après E12) : demande du lien, puis nouveau mot de passe. */

/** Demande d'un lien (réponse identique que le compte existe ou non). */
export async function requestPasswordResetAction(input: unknown): Promise<ActionResult> {
  const parsed = forgotPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Adresse e-mail invalide.", fieldErrors: zodFieldErrors(parsed.error.issues) };
  }
  await sendPasswordResetLink(parsed.data.email, parsed.data.agenceSlug ?? null);
  return { success: RESET_SENT };
}

/** Nouveau mot de passe ; succès : retour à la page de connexion avec un message. */
export async function resetPasswordAction(input: unknown): Promise<ActionResult> {
  const parsed = resetPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return {
      error: "Certains champs sont invalides.",
      fieldErrors: zodFieldErrors(parsed.error.issues),
    };
  }
  const agenceSlug = parsed.data.agenceSlug ?? null;
  const result = await resetPassword(getAdminDb(), {
    jeton: parsed.data.jeton,
    password: parsed.data.password,
    agenceSlug,
  });
  if (!result.ok) return { error: result.error };
  redirect(agenceSlug ? `/a/${agenceSlug}/connexion?reinitialise=1` : "/connexion?reinitialise=1");
}
