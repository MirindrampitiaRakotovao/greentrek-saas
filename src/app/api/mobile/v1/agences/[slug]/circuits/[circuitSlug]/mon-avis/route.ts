import { json, preflight, UNAUTHORIZED } from "@/lib/mobile/http";
import { mobileClientFromRequest } from "@/lib/mobile/session";
import { myCircuitAvis } from "@/lib/services/avis";
import { STATUT_AVIS_VOYAGEUR } from "@/lib/validators/avis";

/**
 * Note du voyageur sur un circuit, depuis sa fiche (étape 5b) : séjour terminé à noter
 * (RG 17) et dernier avis. Un circuit d'une autre agence que celle du compte : rien à noter.
 */
export async function GET(
  request: Request,
  { params }: RouteContext<"/api/mobile/v1/agences/[slug]/circuits/[circuitSlug]/mon-avis">,
) {
  const ctx = await mobileClientFromRequest(request);
  if (!ctx) return UNAUTHORIZED();
  const { slug, circuitSlug } = await params;
  const vide = { reservationId: null, sejour: null, dernierAvis: null, autreAgence: false };
  if (slug !== ctx.user.agenceSlug) return json({ ...vide, autreAgence: true }, { private: true });
  const circuit = await ctx.db.circuit.findFirst({
    where: { slug: circuitSlug, statut: "PUBLIE" },
    select: { id: true },
  });
  if (!circuit) return json(vide, { private: true });
  const mine = await myCircuitAvis(ctx.db, ctx.user.id, circuit.id);
  return json(
    {
      reservationId: mine.reservationId,
      sejour: mine.sejour
        ? {
            dateDebut: mine.sejour.dateDebut.toISOString().slice(0, 10),
            dateFin: mine.sejour.dateFin.toISOString().slice(0, 10),
          }
        : null,
      dernierAvis: mine.dernierAvis
        ? {
            note: mine.dernierAvis.note,
            commentaire: mine.dernierAvis.commentaire,
            statutLabel: STATUT_AVIS_VOYAGEUR[mine.dernierAvis.statut],
          }
        : null,
      autreAgence: false,
    },
    { private: true },
  );
}

export const OPTIONS = preflight;
