import { json, preflight, UNAUTHORIZED } from "@/lib/mobile/http";
import { mobileClientFromRequest } from "@/lib/mobile/session";

/** Voyageur connecté (vérifie le jeton au lancement de l'application). */
export async function GET(request: Request) {
  const session = await mobileClientFromRequest(request);
  if (!session) return UNAUTHORIZED();
  const { user } = session;
  return json(
    { name: user.name, email: user.email, agenceSlug: user.agenceSlug },
    { private: true },
  );
}

export const OPTIONS = preflight;
