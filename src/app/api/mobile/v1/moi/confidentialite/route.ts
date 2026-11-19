import {
  businessError,
  json,
  preflight,
  readJson,
  UNAUTHORIZED,
  validationError,
} from "@/lib/mobile/http";
import { mobileClientFromRequest, mobileProfile } from "@/lib/mobile/session";
import { updatePrivacy } from "@/lib/services/voyageurs";
import { privacySchema } from "@/lib/validators/messagerie";

/** Confidentialité `{ presenceVisible, messagesVoyageurs }` (étape 5c). */
export async function PATCH(request: Request) {
  const ctx = await mobileClientFromRequest(request);
  if (!ctx) return UNAUTHORIZED();
  const parsed = privacySchema.safeParse(await readJson(request));
  if (!parsed.success) return validationError(parsed.error.issues);
  const result = await updatePrivacy(ctx.db, ctx.user.id, parsed.data);
  if (!result.ok) return businessError(result.error, result.field);
  return json(await mobileProfile(ctx.user.id), { private: true });
}

export const OPTIONS = preflight;
