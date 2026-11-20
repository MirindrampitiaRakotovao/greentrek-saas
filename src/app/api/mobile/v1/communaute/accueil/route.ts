import { json, preflight, UNAUTHORIZED } from "@/lib/mobile/http";
import { mobileClientFromRequest } from "@/lib/mobile/session";
import { communityActivity, listDestinations, myCommunityStats } from "@/lib/services/communaute";

/** En-tête du fil : mes chiffres, destinations (vignettes), activité de la communauté. */
export async function GET(request: Request) {
  const ctx = await mobileClientFromRequest(request);
  if (!ctx) return UNAUTHORIZED();
  const [stats, destinations, activite] = await Promise.all([
    myCommunityStats(ctx.user.id),
    listDestinations(),
    communityActivity(),
  ]);
  return json({ stats, destinations, activite }, { private: true });
}

export const OPTIONS = preflight;
