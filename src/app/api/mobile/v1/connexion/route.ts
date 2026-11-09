import { jsonError, json } from "@/lib/mobile/http";
import { mobileLogin } from "@/lib/mobile/session";
import { MOBILE_TOKEN_DAYS } from "@/lib/mobile/token";
import { mobileLoginSchema } from "@/lib/validators/mobile";

const GENERIC_ERROR = "E-mail ou mot de passe incorrect.";

/**
 * Connexion d'un voyageur depuis l'application : `{ email, password, agenceSlug }` →
 * `{ token, user }`. Message unique quelle que soit la cause (compte inconnu, mauvais mot de
 * passe, compte désactivé, agence suspendue, compte du personnel), comme sur le site.
 */
export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  const parsed = mobileLoginSchema.safeParse(body);
  if (!parsed.success) return jsonError(GENERIC_ERROR, 400);
  const session = await mobileLogin(parsed.data);
  if (!session) return jsonError(GENERIC_ERROR, 401);
  return json(
    {
      token: session.token,
      expiresInDays: MOBILE_TOKEN_DAYS,
      user: {
        name: session.user.name,
        email: session.user.email,
        agenceSlug: session.user.agenceSlug,
      },
    },
    { private: true },
  );
}
