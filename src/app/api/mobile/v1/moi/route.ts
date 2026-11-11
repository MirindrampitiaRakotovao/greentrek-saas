import {
  businessError,
  json,
  preflight,
  readJson,
  UNAUTHORIZED,
  validationError,
} from "@/lib/mobile/http";
import { mobileClientFromRequest, mobileProfile } from "@/lib/mobile/session";
import { updateProfile } from "@/lib/services/team";
import { updateProfileSchema } from "@/lib/validators/team";

/** Voyageur connecté (vérifie le jeton au lancement de l'application). */
export async function GET(request: Request) {
  const session = await mobileClientFromRequest(request);
  if (!session) return UNAUTHORIZED();
  return json(await mobileProfile(session.user.id), { private: true });
}

export const OPTIONS = preflight;

/** Modification du profil `{ prenom, nom, telephone }` (même service que le site). */
export async function PATCH(request: Request) {
  const session = await mobileClientFromRequest(request);
  if (!session) return UNAUTHORIZED();
  const parsed = updateProfileSchema.safeParse(await readJson(request));
  if (!parsed.success) return validationError(parsed.error.issues);
  const result = await updateProfile(session.db, session.user.id, parsed.data);
  if (!result.ok) return businessError(result.error, result.field);
  return json(await mobileProfile(session.user.id), { private: true });
}
