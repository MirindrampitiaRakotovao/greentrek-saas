import type { PrismaClient } from "@/generated/prisma/client";
import { buildSeries, type SeriesPoint } from "@/lib/dashboard/series";
import { calendarDate, percentChange, startOfMonth } from "@/lib/dates";

/**
 * Tableau de bord du SUPER_ADMIN (vue plateforme, §7.4). Client non confiné, à n'appeler
 * qu'après la vérification du rôle SUPER_ADMIN.
 *
 * Les agences peuvent avoir des devises différentes : on ne somme jamais des montants entre
 * agences. Les indicateurs globaux sont des comptages ; les montants restent par agence.
 */
export type PlatformDashboard = {
  agences: { actives: number; suspendues: number };
  reservationsMois: { value: number; previous: number; change: number | null };
  departsAVenir: number;
  abonnements: { plan: string; count: number }[];
  chart: SeriesPoint<"reservations">[];
  tableau: {
    id: string;
    nom: string;
    slug: string;
    statut: string;
    devise: string;
    plan: string | null;
    abonnementStatut: string | null;
    circuits: number;
    utilisateurs: number;
    reservationsMois: number;
    montantMois: number;
  }[];
};

export async function getPlatformDashboard(
  db: PrismaClient,
  now: Date = new Date(),
): Promise<PlatformDashboard> {
  const monthStart = startOfMonth(now);
  const previousMonthStart = startOfMonth(now, -1);
  const yearStart = startOfMonth(now, -11);

  const [agences, reservations, departsAVenir] = await Promise.all([
    db.agence.findMany({
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        nom: true,
        slug: true,
        statut: true,
        devise: true,
        abonnements: {
          orderBy: { dateDebut: "desc" },
          take: 1,
          select: { statut: true, plan: { select: { nom: true } } },
        },
        _count: {
          select: { circuits: true, utilisateurs: { where: { role: { not: "CLIENT" } } } },
        },
      },
    }),
    db.reservation.findMany({
      where: { createdAt: { gte: yearStart }, statut: { not: "ANNULEE" } },
      select: { agenceId: true, createdAt: true, montantTotal: true },
    }),
    db.sessionDepart.count({
      where: { dateDebut: { gte: calendarDate(now) }, statut: { in: ["OUVERTE", "COMPLETE"] } },
    }),
  ]);

  const thisMonth = reservations.filter((r) => r.createdAt >= monthStart);
  const lastMonth = reservations.filter(
    (r) => r.createdAt >= previousMonthStart && r.createdAt < monthStart,
  );

  const plans = new Map<string, number>();
  for (const agence of agences) {
    const plan = agence.abonnements[0]?.plan.nom ?? "Sans abonnement";
    plans.set(plan, (plans.get(plan) ?? 0) + 1);
  }

  return {
    agences: {
      actives: agences.filter((a) => a.statut === "ACTIVE").length,
      suspendues: agences.filter((a) => a.statut === "SUSPENDUE").length,
    },
    reservationsMois: {
      value: thisMonth.length,
      previous: lastMonth.length,
      change: percentChange(thisMonth.length, lastMonth.length),
    },
    departsAVenir,
    abonnements: [...plans.entries()].map(([plan, count]) => ({ plan, count })),
    chart: buildSeries(
      reservations.map((r) => ({ at: r.createdAt, series: "reservations" as const, amount: 1 })),
      ["reservations"],
      "12m",
      now,
    ),
    tableau: agences.map((agence) => {
      const mine = thisMonth.filter((r) => r.agenceId === agence.id);
      return {
        id: agence.id,
        nom: agence.nom,
        slug: agence.slug,
        statut: agence.statut,
        devise: agence.devise,
        plan: agence.abonnements[0]?.plan.nom ?? null,
        abonnementStatut: agence.abonnements[0]?.statut ?? null,
        circuits: agence._count.circuits,
        utilisateurs: agence._count.utilisateurs,
        reservationsMois: mine.length,
        montantMois: mine.reduce((n, r) => n + r.montantTotal, 0),
      };
    }),
  };
}
