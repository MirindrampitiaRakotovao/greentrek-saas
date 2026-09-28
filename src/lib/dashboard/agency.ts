import type { StatutReservation } from "@/generated/prisma/client";
import { buildSeries, RANGES, type Range, type SeriesPoint } from "@/lib/dashboard/series";
import { calendarDate, percentChange, startOfMonth } from "@/lib/dates";
import type { TenantDb } from "@/lib/tenant";

/**
 * Indicateurs du tableau de bord d'une agence (avancée de l'étape E10, §7.3).
 * Toutes les requêtes passent par le client CONFINÉ : les chiffres ne portent que sur
 * l'agence de l'utilisateur. Les définitions ci-dessous sont celles citées dans le mémoire.
 *
 * - Réservations du mois : réservations créées depuis le 1er du mois (heure de Madagascar),
 *   hors annulées, comparées au mois précédent entier.
 * - Montant réservé : somme des montants figés (RG 14) de ces réservations.
 * - Paiements encaissés : paiements simulés au statut VALIDE, par date de paiement.
 * - Taux de remplissage : personnes réservées (hors annulations) / places des départs à venir
 *   non annulés.
 */

const ACTIVE_RESERVATION = { not: "ANNULEE" } as const;
const ACTIVE_SESSION = ["OUVERTE", "COMPLETE"] as const;

export type Trend = { value: number; previous: number; change: number | null };
export type ChartSeries = "reserve" | "encaisse";

export type AgencyDashboard = {
  devise: string;
  kpis: {
    reservations: Trend;
    montantReserve: Trend;
    encaisse: Trend;
    remplissage: { taux: number | null; reservees: number; places: number; departs: number };
  };
  chart: Record<Range, SeriesPoint<ChartSeries>[]>;
  statuts: { statut: StatutReservation; count: number }[];
  dernieresReservations: {
    id: string;
    reference: string;
    client: string;
    circuit: string;
    dateDepart: Date;
    montant: number;
    statut: StatutReservation;
  }[];
  prochainsDeparts: {
    id: string;
    circuit: string;
    dateDebut: Date;
    dateFin: Date;
    reservees: number;
    places: number;
    guide: string | null;
    statut: string;
  }[];
  topCircuits: { id: string; titre: string; reservations: number; montant: number }[];
  circuitsPublies: number;
  abonnement: {
    plan: string;
    statut: string;
    dateFin: Date | null;
    usage: { label: string; used: number; max: number }[];
  } | null;
  activite: {
    id: string;
    kind: "reservation" | "paiement" | "annulation";
    titre: string;
    detail: string;
    at: Date;
  }[];
};

function trend(value: number, previous: number): Trend {
  return { value, previous, change: percentChange(value, previous) };
}

export async function getAgencyDashboard(
  db: TenantDb,
  agenceId: string,
  now: Date = new Date(),
): Promise<AgencyDashboard> {
  const monthStart = startOfMonth(now);
  const previousMonthStart = startOfMonth(now, -1);
  const yearStart = startOfMonth(now, -11);
  const today = calendarDate(now);

  const [agence, reservations, paiements, upcoming, recent, abonnement, circuitsPublies] =
    await Promise.all([
      db.agence.findUniqueOrThrow({ where: { id: agenceId }, select: { devise: true } }),
      // 12 derniers mois : sert aux indicateurs, au graphique, aux statuts et au classement.
      db.reservation.findMany({
        where: { createdAt: { gte: yearStart } },
        select: {
          createdAt: true,
          montantTotal: true,
          statut: true,
          session: { select: { circuit: { select: { id: true, titre: true } } } },
        },
      }),
      db.paiement.findMany({
        where: { statut: "VALIDE", payeLe: { gte: yearStart } },
        select: { montant: true, payeLe: true },
      }),
      db.sessionDepart.findMany({
        where: { dateDebut: { gte: today }, statut: { in: [...ACTIVE_SESSION] } },
        orderBy: { dateDebut: "asc" },
        select: {
          id: true,
          dateDebut: true,
          dateFin: true,
          placesTotal: true,
          statut: true,
          circuit: { select: { titre: true } },
          guide: { select: { prenom: true, nom: true } },
          reservations: {
            where: { statut: ACTIVE_RESERVATION },
            select: { nombrePersonnes: true },
          },
        },
      }),
      db.reservation.findMany({
        orderBy: { createdAt: "desc" },
        take: 8,
        select: {
          id: true,
          reference: true,
          montantTotal: true,
          statut: true,
          createdAt: true,
          annuleeAt: true,
          nombrePersonnes: true,
          client: { select: { prenom: true, nom: true } },
          session: { select: { dateDebut: true, circuit: { select: { titre: true } } } },
          paiements: {
            where: { statut: "VALIDE" },
            select: { id: true, montant: true, payeLe: true },
          },
        },
      }),
      db.abonnement.findFirst({
        orderBy: { dateDebut: "desc" },
        select: {
          statut: true,
          dateFin: true,
          plan: {
            select: {
              nom: true,
              maxCircuits: true,
              maxUtilisateurs: true,
              maxSessionsActives: true,
            },
          },
        },
      }),
      db.circuit.count({ where: { statut: "PUBLIE" } }),
    ]);

  // ── Indicateurs du mois ──
  const inRange = (date: Date, from: Date, to?: Date) => date >= from && (!to || date < to);
  const actives = reservations.filter((r) => r.statut !== "ANNULEE");
  const thisMonth = actives.filter((r) => inRange(r.createdAt, monthStart));
  const lastMonth = actives.filter((r) => inRange(r.createdAt, previousMonthStart, monthStart));
  const sum = (items: { montantTotal: number }[]) => items.reduce((n, r) => n + r.montantTotal, 0);
  const paid = (from: Date, to?: Date) =>
    paiements
      .filter((p) => p.payeLe && inRange(p.payeLe, from, to))
      .reduce((n, p) => n + p.montant, 0);

  const places = upcoming.reduce((n, s) => n + s.placesTotal, 0);
  const reservees = upcoming.reduce(
    (n, s) => n + s.reservations.reduce((m, r) => m + r.nombrePersonnes, 0),
    0,
  );

  // ── Graphique : montant réservé et encaissé, même unité (un seul axe) ──
  const amounts = [
    ...actives.map((r) => ({
      at: r.createdAt,
      series: "reserve" as const,
      amount: r.montantTotal,
    })),
    ...paiements.flatMap((p) =>
      p.payeLe ? [{ at: p.payeLe, series: "encaisse" as const, amount: p.montant }] : [],
    ),
  ];
  const chart = Object.fromEntries(
    RANGES.map((range) => [range, buildSeries(amounts, ["reserve", "encaisse"], range, now)]),
  ) as Record<Range, SeriesPoint<ChartSeries>[]>;

  // ── Répartition par statut (12 mois) ──
  const statutOrder: StatutReservation[] = ["CONFIRMEE", "EN_ATTENTE", "TERMINEE", "ANNULEE"];
  const statuts = statutOrder.map((statut) => ({
    statut,
    count: reservations.filter((r) => r.statut === statut).length,
  }));

  // ── Circuits les plus réservés (12 mois, hors annulations) ──
  const byCircuit = new Map<
    string,
    { id: string; titre: string; reservations: number; montant: number }
  >();
  for (const r of actives) {
    const { id, titre } = r.session.circuit;
    const entry = byCircuit.get(id) ?? { id, titre, reservations: 0, montant: 0 };
    entry.reservations += 1;
    entry.montant += r.montantTotal;
    byCircuit.set(id, entry);
  }
  const topCircuits = [...byCircuit.values()].sort((a, b) => b.montant - a.montant).slice(0, 2);

  // ── Abonnement et limites du plan (RG 18, appliquées en E11) ──
  let abonnementInfo: AgencyDashboard["abonnement"] = null;
  if (abonnement) {
    const [circuits, utilisateurs] = await Promise.all([
      db.circuit.count({ where: { statut: { not: "ARCHIVE" } } }),
      db.utilisateur.count({ where: { role: { not: "CLIENT" }, actif: true } }),
    ]);
    abonnementInfo = {
      plan: abonnement.plan.nom,
      statut: abonnement.statut,
      dateFin: abonnement.dateFin,
      usage: [
        { label: "Circuits", used: circuits, max: abonnement.plan.maxCircuits },
        { label: "Utilisateurs", used: utilisateurs, max: abonnement.plan.maxUtilisateurs },
        { label: "Départs actifs", used: upcoming.length, max: abonnement.plan.maxSessionsActives },
      ],
    };
  }

  // ── Activité récente : événements réels (réservations, paiements, annulations) ──
  const activite: AgencyDashboard["activite"] = recent
    .flatMap((r) => {
      const client = `${r.client.prenom} ${r.client.nom}`;
      const events: AgencyDashboard["activite"] = [
        {
          id: `${r.id}-r`,
          kind: "reservation",
          titre: "Nouvelle réservation",
          detail: `${r.reference} · ${client} · ${r.nombrePersonnes} pers.`,
          at: r.createdAt,
        },
      ];
      for (const p of r.paiements) {
        if (p.payeLe) {
          events.push({
            id: p.id,
            kind: "paiement",
            titre: "Paiement reçu",
            detail: `${r.reference} · ${client}`,
            at: p.payeLe,
          });
        }
      }
      if (r.annuleeAt) {
        events.push({
          id: `${r.id}-a`,
          kind: "annulation",
          titre: "Réservation annulée",
          detail: `${r.reference} · ${client}`,
          at: r.annuleeAt,
        });
      }
      return events;
    })
    .filter((event) => event.at <= now)
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, 6);

  return {
    devise: agence.devise,
    kpis: {
      reservations: trend(thisMonth.length, lastMonth.length),
      montantReserve: trend(sum(thisMonth), sum(lastMonth)),
      encaisse: trend(paid(monthStart), paid(previousMonthStart, monthStart)),
      remplissage: {
        taux: places > 0 ? Math.round((reservees / places) * 100) : null,
        reservees,
        places,
        departs: upcoming.length,
      },
    },
    chart,
    statuts,
    dernieresReservations: recent.slice(0, 6).map((r) => ({
      id: r.id,
      reference: r.reference,
      client: `${r.client.prenom} ${r.client.nom}`,
      circuit: r.session.circuit.titre,
      dateDepart: r.session.dateDebut,
      montant: r.montantTotal,
      statut: r.statut,
    })),
    prochainsDeparts: upcoming.slice(0, 4).map((s) => ({
      id: s.id,
      circuit: s.circuit.titre,
      dateDebut: s.dateDebut,
      dateFin: s.dateFin,
      reservees: s.reservations.reduce((n, r) => n + r.nombrePersonnes, 0),
      places: s.placesTotal,
      guide: s.guide ? `${s.guide.prenom} ${s.guide.nom}` : null,
      statut: s.statut,
    })),
    topCircuits,
    circuitsPublies,
    abonnement: abonnementInfo,
    activite,
  };
}
