"use server";

import { redirect } from "next/navigation";
import { after } from "next/server";

import { zodFieldErrors } from "@/lib/actions/helpers";
import type { ActionResult } from "@/lib/actions/types";
import { getAdminDb } from "@/lib/admin-db";
import { sendMail } from "@/lib/mail/mailer";
import { passwordResetMail } from "@/lib/mail/templates";
import { requestBaseUrl } from "@/lib/public-url";
import {
  RESET_VALIDITY_MINUTES,
  requestPasswordReset,
  resetPassword,
} from "@/lib/services/mot-de-passe";
import { forgotPasswordSchema, resetPasswordSchema } from "@/lib/validators/auth";

/* « Mot de passe oublié » (après E12) : demande du lien, puis nouveau mot de passe. */

const SENT =
  "Si un compte correspond à cette adresse, vous allez recevoir un e-mail avec un lien pour choisir un nouveau mot de passe (valable 1 heure). Pensez à regarder dans les indésirables.";

/**
 * Demande d'un lien. Réponse IDENTIQUE que l'adresse corresponde à un compte ou non, et
 * l'e-mail part APRÈS la réponse (`after`) : ni le message ni le temps de réponse ne
 * révèlent si un compte existe.
 */
export async function requestPasswordResetAction(input: unknown): Promise<ActionResult> {
  const parsed = forgotPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Adresse e-mail invalide.", fieldErrors: zodFieldErrors(parsed.error.issues) };
  }
  const agenceSlug = parsed.data.agenceSlug ?? null;
  const demande = await requestPasswordReset(getAdminDb(), {
    email: parsed.data.email,
    agenceSlug,
  });
  if (demande) {
    const chemin = agenceSlug
      ? `/a/${agenceSlug}/reinitialiser-mot-de-passe`
      : "/reinitialiser-mot-de-passe";
    const lien = `${await requestBaseUrl()}${chemin}?jeton=${demande.jeton}`;
    const mail = passwordResetMail({
      prenom: demande.prenom,
      lien,
      espace: demande.espace,
      validiteMinutes: RESET_VALIDITY_MINUTES,
    });
    after(async () => {
      await sendMail({ to: demande.to, ...mail });
    });
  }
  return { success: SENT };
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
