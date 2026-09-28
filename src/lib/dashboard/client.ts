import type { StatutReservation } from "@/generated/prisma/client";
import { calendarDate } from "@/lib/dates";
import type { TenantDb } from "@/lib/tenant";

/**
 * Tableau de bord d'un CLIENT (espace « Mon compte ») : uniquement SES réservations
 * (§7.2 : « un client ne voit que ses propres réservations »), dans l'agence du site.
 */
export type ClientDashboard = {
  devise: string;
  aVenir: number;
  termines: number;
  totalPaye: number;
  resteAPayer: number;
  prochain: {
    reference: string;
    circuit: string;
    dateDebut: Date;
    dateFin: Date;
    nombrePersonnes: number;
    statut: StatutReservation;
  } | null;
  reservations: {
    id: string;
    reference: string;
    circuit: string;
    dateDebut: Date;
    nombrePersonnes: number;
    montant: number;
    paye: number;
    statut: StatutReservation;
  }[];
};

export async function getClientDashboard(
  db: TenantDb,
  agenceId: string,
  clientId: string,
  now: Date = new Date(),
): Promise<ClientDashboard> {
  const [agence, reservations] = await Promise.all([
    db.agence.findUniqueOrThrow({ where: { id: agenceId }, select: { devise: true } }),
    db.reservation.findMany({
      where: { clientId },
      orderBy: { session: { dateDebut: "desc" } },
      select: {
        id: true,
        reference: true,
        nombrePersonnes: true,
        montantTotal: true,
        statut: true,
        session: {
          select: { dateDebut: true, dateFin: true, circuit: { select: { titre: true } } },
        },
        paiements: { where: { statut: "VALIDE" }, select: { montant: true } },
      },
    }),
  ]);

  const today = calendarDate(now);
  const rows = reservations.map((r) => ({
    id: r.id,
    reference: r.reference,
    circuit: r.session.circuit.titre,
    dateDebut: r.session.dateDebut,
    dateFin: r.session.dateFin,
    nombrePersonnes: r.nombrePersonnes,
    montant: r.montantTotal,
    paye: r.paiements.reduce((n, p) => n + p.montant, 0),
    statut: r.statut,
  }));
  const upcoming = rows
    .filter((r) => r.statut !== "ANNULEE" && r.dateDebut >= today)
    .sort((a, b) => a.dateDebut.getTime() - b.dateDebut.getTime());
  const actives = rows.filter((r) => r.statut !== "ANNULEE");
  const next = upcoming[0];

  return {
    devise: agence.devise,
    aVenir: upcoming.length,
    termines: rows.filter((r) => r.statut === "TERMINEE").length,
    totalPaye: rows.reduce((n, r) => n + r.paye, 0),
    resteAPayer: actives.reduce((n, r) => n + Math.max(0, r.montant - r.paye), 0),
    prochain: next
      ? {
          reference: next.reference,
          circuit: next.circuit,
          dateDebut: next.dateDebut,
          dateFin: next.dateFin,
          nombrePersonnes: next.nombrePersonnes,
          statut: next.statut,
        }
      : null,
    reservations: rows.slice(0, 8),
  };
}
