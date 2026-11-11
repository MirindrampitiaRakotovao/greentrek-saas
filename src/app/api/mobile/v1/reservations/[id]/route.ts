import { invoicePath, invoiceSecret, signInvoice } from "@/lib/invoice";
import { currentAgence } from "@/lib/mobile/context";
import { json, jsonError, preflight, UNAUTHORIZED } from "@/lib/mobile/http";
import { toMobileReservation } from "@/lib/mobile/reservations";
import { mobileClientFromRequest } from "@/lib/mobile/session";
import { getClientReservation } from "@/lib/services/reservations";

/** Une réservation du voyageur (404 pour la réservation d'un autre client ou d'une autre agence). */
export async function GET(
  request: Request,
  { params }: RouteContext<"/api/mobile/v1/reservations/[id]">,
) {
  const ctx = await mobileClientFromRequest(request);
  if (!ctx) return UNAUTHORIZED();
  const { id } = await params;
  const [agence, reservation] = await Promise.all([
    currentAgence(ctx.db),
    getClientReservation(ctx.db, id, ctx.user.id),
  ]);
  if (!reservation) return jsonError("Réservation introuvable.", 404);
  // Lien signé de la facture : le secret reste sur le serveur (même mécanisme que le QR code).
  const facture = invoicePath(
    agence.slug,
    reservation.id,
    signInvoice(invoiceSecret(), ctx.user.agenceId, reservation.id),
  );
  return json(toMobileReservation(reservation, agence, facture), { private: true });
}

export const OPTIONS = preflight;
