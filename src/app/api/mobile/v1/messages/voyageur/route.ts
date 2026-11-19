import {
  businessError,
  json,
  preflight,
  readJson,
  UNAUTHORIZED,
  validationError,
} from "@/lib/mobile/http";
import { mobileClientFromRequest } from "@/lib/mobile/session";
import { startPrivateConversation } from "@/lib/services/messagerie";
import { privateMessageSchema } from "@/lib/validators/messagerie";

/**
 * Premier message à un autre voyageur `{ destinataireId, contenu }` (étape 5c) ; reprend la
 * conversation existante entre vous deux s'il y en a une.
 */
export async function POST(request: Request) {
  const ctx = await mobileClientFromRequest(request);
  if (!ctx) return UNAUTHORIZED();
  const parsed = privateMessageSchema.safeParse(await readJson(request));
  if (!parsed.success) return validationError(parsed.error.issues);
  const result = await startPrivateConversation(
    ctx.db,
    { id: ctx.user.id, role: ctx.user.role },
    { ...parsed.data, agenceId: ctx.user.agenceId },
  );
  if (!result.ok) return businessError(result.error, result.field);
  return json(result.data, { status: 201, private: true });
}

export const OPTIONS = preflight;
