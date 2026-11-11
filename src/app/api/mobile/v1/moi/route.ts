import { json, preflight, UNAUTHORIZED } from "@/lib/mobile/http";
import { mobileClientFromRequest, mobileProfile } from "@/lib/mobile/session";

/** Voyageur connecté (vérifie le jeton au lancement de l'application). */
export async function GET(request: Request) {
  const session = await mobileClientFromRequest(request);
  if (!session) return UNAUTHORIZED();
  return json(await mobileProfile(session.user.id), { private: true });
}

export const OPTIONS = preflight;
