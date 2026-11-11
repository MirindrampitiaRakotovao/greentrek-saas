import "server-only";

import { after } from "next/server";

import { getAdminDb } from "@/lib/admin-db";
import { sendMail } from "@/lib/mail/mailer";
import { passwordResetMail } from "@/lib/mail/templates";
import { requestBaseUrl } from "@/lib/public-url";
import { RESET_VALIDITY_MINUTES, requestPasswordReset } from "@/lib/services/mot-de-passe";

/** Réponse unique, que l'adresse corresponde à un compte ou non. */
export const RESET_SENT =
  "Si un compte correspond à cette adresse, vous allez recevoir un e-mail avec un lien pour choisir un nouveau mot de passe (valable 1 heure). Pensez à regarder dans les indésirables.";

/**
 * Demande d'un lien « mot de passe oublié » (site et application mobile). L'e-mail part APRÈS
 * la réponse (`after`) : ni le message ni le temps de réponse ne révèlent si un compte existe.
 * Le lien ouvre la page de réinitialisation du site (agence du voyageur, ou plateforme).
 */
export async function sendPasswordResetLink(email: string, agenceSlug: string | null) {
  const demande = await requestPasswordReset(getAdminDb(), { email, agenceSlug });
  if (!demande) return;
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
