import {
  businessError,
  json,
  preflight,
  readJson,
  UNAUTHORIZED,
  validationError,
} from "@/lib/mobile/http";
import { mobileClientFromRequest } from "@/lib/mobile/session";
import { reportMessage } from "@/lib/services/voyageurs";
import { reportMessageSchema } from "@/lib/validators/messagerie";

/** Signaler à l'agence un message reçu d'un autre voyageur `{ messageId, motif }` (étape 5c). */
export async function POST(request: Request) {
  const ctx = await mobileClientFromRequest(request);
  if (!ctx) return UNAUTHORIZED();
  const body = await readJson(request);
  const parsed = reportMessageSchema.safeParse({
    motif: null,
    ...(body && typeof body === "object" ? body : {}),
  });
  if (!parsed.success) return validationError(parsed.error.issues);
  const result = await reportMessage(ctx.db, {
    ...parsed.data,
    agenceId: ctx.user.agenceId,
    auteurId: ctx.user.id,
  });
  if (!result.ok) return businessError(result.error, result.field);
  return json({ ok: true }, { status: 201, private: true });
}

export const OPTIONS = preflight;
