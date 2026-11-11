import {
  businessError,
  json,
  jsonError,
  preflight,
  readJson,
  validationError,
} from "@/lib/mobile/http";
import { mobileLogin, mobileProfile } from "@/lib/mobile/session";
import { MOBILE_TOKEN_DAYS } from "@/lib/mobile/token";
import { registerClient } from "@/lib/services/clients";
import { clientRegistrationSchema } from "@/lib/validators/auth";

/**
 * Création d'un compte voyageur depuis l'application, auprès de l'agence choisie (même
 * service et mêmes règles que le site : RG 2, RG 3), puis connexion : `{ token, user }`.
 */
export async function POST(request: Request) {
  const parsed = clientRegistrationSchema.safeParse(await readJson(request));
  if (!parsed.success) return validationError(parsed.error.issues);
  const result = await registerClient(parsed.data);
  if (!result.ok) {
    return businessError(result.message, result.field === "email" ? "email" : undefined);
  }
  const session = await mobileLogin({
    email: parsed.data.email,
    password: parsed.data.password,
    agenceSlug: parsed.data.agenceSlug,
  });
  if (!session) return jsonError("Compte créé : connectez-vous.", 401);
  return json(
    {
      token: session.token,
      expiresInDays: MOBILE_TOKEN_DAYS,
      user: await mobileProfile(session.user.id),
    },
    { status: 201, private: true },
  );
}

export const OPTIONS = preflight;
