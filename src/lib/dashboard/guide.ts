import { calendarDate } from "@/lib/dates";
import type { TenantDb } from "@/lib/tenant";

/**
 * Tableau de bord d'un GUIDE : uniquement SES départs (matrice §3 : « ses départs et la liste
 * de ses participants »). Le guide est retrouvé par sa fiche reliée à son compte.
 */
export type GuideDashboard = {
  aVenir: number;
  participantsAttendus: number;
  encadres: number;
  departs: {
    id: string;
    circuit: string;
    dateDebut: Date;
    dateFin: Date;
    participants: number;
    places: number;
    reservations: number;
  }[];
};

export async function getGuideDashboard(
  db: TenantDb,
  userId: string,
  now: Date = new Date(),
): Promise<GuideDashboard | null> {
  const fiche = await db.guide.findFirst({
    where: { utilisateurId: userId },
    select: { id: true },
  });
  if (!fiche) return null;

  const [upcoming, encadres] = await Promise.all([
    db.sessionDepart.findMany({
      where: {
        guideId: fiche.id,
        dateFin: { gte: calendarDate(now) },
        statut: { in: ["OUVERTE", "COMPLETE"] },
      },
      orderBy: { dateDebut: "asc" },
      select: {
        id: true,
        dateDebut: true,
        dateFin: true,
        placesTotal: true,
        circuit: { select: { titre: true } },
        reservations: { where: { statut: { not: "ANNULEE" } }, select: { nombrePersonnes: true } },
      },
    }),
    db.sessionDepart.count({ where: { guideId: fiche.id, statut: "TERMINEE" } }),
  ]);

  const departs = upcoming.map((s) => ({
    id: s.id,
    circuit: s.circuit.titre,
    dateDebut: s.dateDebut,
    dateFin: s.dateFin,
    participants: s.reservations.reduce((n, r) => n + r.nombrePersonnes, 0),
    places: s.placesTotal,
    reservations: s.reservations.length,
  }));

  return {
    aVenir: departs.length,
    participantsAttendus: departs.reduce((n, d) => n + d.participants, 0),
    encadres,
    departs,
  };
}
