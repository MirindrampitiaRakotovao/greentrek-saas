import { getCurrentUser } from "@/lib/auth/session";
import { toCsv } from "@/lib/csv";
import { formatDateTime } from "@/lib/format";
import { can } from "@/lib/permissions";
import { exportReservations } from "@/lib/services/gestion-reservations";
import { getTenantDb } from "@/lib/tenant";
import { reservationFiltersSchema, STATUT_RESERVATION_LABELS } from "@/lib/validators/reservations";

/** Date calendaire (colonne SQL DATE) au format AAAA-MM-JJ, triable dans un tableur. */
const isoDay = (date: Date) => date.toISOString().slice(0, 10);

/**
 * Export CSV des réservations filtrées (§7.6, P2). Mêmes filtres que la liste, même
 * contrôle d'accès (session relue en base, permission, client confiné à l'agence).
 */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user?.agenceId || !can(user.role, "modifier", "reservation")) {
    return new Response("Accès refusé.", { status: 403 });
  }
  const params = new URL(request.url).searchParams;
  const filters = reservationFiltersSchema.parse({
    periode: params.get("periode") ?? undefined,
    statut: params.get("statut") ?? undefined,
    circuitId: params.get("circuit") ?? undefined,
    q: params.get("q") ?? undefined,
  });
  const rows = await exportReservations(getTenantDb(user.agenceId), filters);
  const csv = toCsv(
    [
      "Référence",
      "Statut",
      "Client",
      "E-mail",
      "Circuit",
      "Début",
      "Fin",
      "Personnes",
      "Montant (entier)",
      "Payé (entier)",
      "Réservée le",
    ],
    rows.map((r) => [
      r.reference,
      STATUT_RESERVATION_LABELS[r.statut],
      `${r.client.prenom} ${r.client.nom}`,
      r.client.email,
      r.session.circuit.titre,
      isoDay(r.session.dateDebut),
      isoDay(r.session.dateFin),
      r.nombrePersonnes,
      r.montantTotal,
      r.paye,
      formatDateTime(r.createdAt),
    ]),
  );
  const date = isoDay(new Date());
  // BOM UTF-8 : Excel affiche correctement les accents.
  return new Response(`﻿${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="reservations-${date}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
