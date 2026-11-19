import { json, preflight, UNAUTHORIZED } from "@/lib/mobile/http";
import { mobileClientFromRequest } from "@/lib/mobile/session";
import { listSejoursPartageables } from "@/lib/services/communaute";

/** Séjours terminés du voyageur : ceux dont il peut partager les photos. */
export async function GET(request: Request) {
  const ctx = await mobileClientFromRequest(request);
  if (!ctx) return UNAUTHORIZED();
  const sejours = await listSejoursPartageables(ctx.user.id);
  return json(
    {
      sejours: sejours.map((s) => ({
        id: s.id,
        reference: s.reference,
        circuit: s.circuit,
        dateDebut: s.dateDebut.toISOString().slice(0, 10),
        dateFin: s.dateFin.toISOString().slice(0, 10),
      })),
    },
    { private: true },
  );
}

export const OPTIONS = preflight;
