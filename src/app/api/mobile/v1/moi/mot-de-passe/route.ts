import {
  businessError,
  json,
  preflight,
  readJson,
  UNAUTHORIZED,
  validationError,
} from "@/lib/mobile/http";
import { mobileClientFromRequest } from "@/lib/mobile/session";
import { changePassword } from "@/lib/services/team";
import { changePasswordSchema } from "@/lib/validators/team";

/**
 * Changement de mot de passe `{ currentPassword, newPassword, confirmPassword }` : l'ancien
 * est exigé (même service et mêmes règles que le site). Le jeton reste valable.
 */
export async function POST(request: Request) {
  const session = await mobileClientFromRequest(request);
  if (!session) return UNAUTHORIZED();
  const parsed = changePasswordSchema.safeParse(await readJson(request));
  if (!parsed.success) return validationError(parsed.error.issues);
  const result = await changePassword(session.db, session.user.id, parsed.data);
  if (!result.ok) return businessError(result.error, result.field);
  return json({ message: "Mot de passe modifié." }, { private: true });
}

export const OPTIONS = preflight;
