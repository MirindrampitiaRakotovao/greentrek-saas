import { z } from "zod";

import { RESET_SENT, sendPasswordResetLink } from "@/lib/mail/password-reset";
import { json, preflight, readJson, validationError } from "@/lib/mobile/http";
import { forgotPasswordSchema } from "@/lib/validators/auth";

/** Mot de passe oublié d'un voyageur : l'agence du compte est obligatoire. */
const schema = forgotPasswordSchema.extend({
  agenceSlug: z.string().trim().min(1, { error: "Choisissez l'agence de votre compte." }),
});

/**
 * Envoi du lien de réinitialisation (même logique que le site) : réponse identique que le
 * compte existe ou non. Le lien de l'e-mail ouvre la page du site de l'agence.
 */
export async function POST(request: Request) {
  const parsed = schema.safeParse(await readJson(request));
  if (!parsed.success) return validationError(parsed.error.issues);
  await sendPasswordResetLink(parsed.data.email, parsed.data.agenceSlug);
  return json({ message: RESET_SENT });
}

export const OPTIONS = preflight;
