import { json, preflight, readJson, UNAUTHORIZED, validationError } from "@/lib/mobile/http";
import { mobileClientFromRequest } from "@/lib/mobile/session";
import { markNotificationsRead } from "@/lib/services/notifications";
import { readNotificationsSchema } from "@/lib/validators/mobile";

/** Marque comme lues les notifications du voyageur `{ ids? }` (toutes si `ids` est absent). */
export async function POST(request: Request) {
  const ctx = await mobileClientFromRequest(request);
  if (!ctx) return UNAUTHORIZED();
  const parsed = readNotificationsSchema.safeParse((await readJson(request)) ?? {});
  if (!parsed.success) return validationError(parsed.error.issues);
  await markNotificationsRead(ctx.db, ctx.user.id, parsed.data.ids);
  return json({ ok: true }, { private: true });
}

export const OPTIONS = preflight;
