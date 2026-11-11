import { mobileNotifications } from "@/lib/mobile/activite";
import { json, preflight, UNAUTHORIZED } from "@/lib/mobile/http";
import { mobileClientFromRequest } from "@/lib/mobile/session";

/** Notifications du voyageur (les plus récentes d'abord) et nombre de non lues. */
export async function GET(request: Request) {
  const ctx = await mobileClientFromRequest(request);
  if (!ctx) return UNAUTHORIZED();
  return json(await mobileNotifications(ctx.db, ctx.user.id), { private: true });
}

export const OPTIONS = preflight;
