import {
  businessError,
  json,
  preflight,
  readJson,
  UNAUTHORIZED,
  validationError,
} from "@/lib/mobile/http";
import { mobileClientFromRequest } from "@/lib/mobile/session";
import { reportContent } from "@/lib/services/communaute";
import { reportContentSchema } from "@/lib/validators/communaute";

/** Signaler une publication ou un commentaire `{ cible, cibleId, motif }` (super admin). */
export async function POST(request: Request) {
  const ctx = await mobileClientFromRequest(request);
  if (!ctx) return UNAUTHORIZED();
  const body = await readJson(request);
  const parsed = reportContentSchema.safeParse({
    motif: null,
    ...(body && typeof body === "object" ? body : {}),
  });
  if (!parsed.success) return validationError(parsed.error.issues);
  const result = await reportContent(ctx.user.id, parsed.data);
  if (!result.ok) return businessError(result.error, result.field);
  return json({ ok: true }, { status: 201, private: true });
}

export const OPTIONS = preflight;
