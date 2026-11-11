import { mobileActivity } from "@/lib/mobile/activite";
import { json, preflight, UNAUTHORIZED } from "@/lib/mobile/http";
import { mobileClientFromRequest } from "@/lib/mobile/session";
import { activityQuerySchema } from "@/lib/validators/mobile";

/**
 * Nouveautés pour le voyageur `?depuis=<date ISO>` : appelée régulièrement par l'application
 * ouverte, qui affiche alors une notification du téléphone (avec son) pour chaque nouveauté.
 */
export async function GET(request: Request) {
  const ctx = await mobileClientFromRequest(request);
  if (!ctx) return UNAUTHORIZED();
  const { depuis } = activityQuerySchema.parse(
    Object.fromEntries(new URL(request.url).searchParams),
  );
  const data = await mobileActivity(
    ctx.db,
    { id: ctx.user.id, role: "CLIENT" },
    depuis ? new Date(depuis) : null,
    new Date(),
  );
  return json(data, { private: true });
}

export const OPTIONS = preflight;
