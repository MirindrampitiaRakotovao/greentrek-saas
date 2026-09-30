import type { Prisma, StatutSession } from "@/generated/prisma/client";
import { calendarDate } from "@/lib/dates";
import {
  computeSessionStatut,
  parseIsoDate,
  periodsOverlap,
  placesReservees,
  toIsoDate,
} from "@/lib/departs";
import { type Paginated, pageArgs, pageCount } from "@/lib/pagination";
import { checkPlanLimit } from "@/lib/services/abonnements";
import { notifyReservationClient } from "@/lib/services/notifications";
import { failure, type ServiceResult, success } from "@/lib/services/result";
import type { TenantDb, TenantTx } from "@/lib/tenant";
import type { DepartFilters, DepartInput, UpdateDepartInput } from "@/lib/validators/departs";

/**
 * Départs (sessions) d'un circuit : l'objet « disponibilité » (§5.2 table 7, §7.3).
 *
 * - RG 10 : date de fin ≥ date de début (schéma Zod + contrainte CHECK en base).
 * - RG 11 : statut recalculé à chaque changement (`refreshSessionStatut`) ; les départs dont
 *   la date de fin est passée sont basculés en TERMINEE à l'affichage (`syncTermines`).
 * - RG 13 : on ne peut pas réduire le nombre de places sous le nombre de places réservées.
 * - Décision A (E7) : départ possible pour un circuit publié ou brouillon, pas archivé.
 * - Décision B : places ≤ capacité maximale du circuit.
 * - Décision C : un guide n'encadre pas deux départs non annulés qui se chevauchent.
 * - Décision D : l'annulation d'un départ annule ses réservations actives (même transaction).
 */

type Db = TenantDb | TenantTx;

/** Réservations qui comptent pour le remplissage (sélection commune). */
const reservationsActives = {
  where: { statut: { not: "ANNULEE" } },
  select: { nombrePersonnes: true, statut: true },
} satisfies Prisma.SessionDepart$reservationsArgs;

const departListSelect = {
  id: true,
  dateDebut: true,
  dateFin: true,
  placesTotal: true,
  prixParPersonne: true,
  statut: true,
  circuit: { select: { id: true, titre: true, prixParPersonne: true } },
  guide: { select: { id: true, prenom: true, nom: true } },
  reservations: reservationsActives,
} satisfies Prisma.SessionDepartSelect;

type DepartListPayload = Prisma.SessionDepartGetPayload<{ select: typeof departListSelect }>;

export type DepartRow = Omit<DepartListPayload, "reservations"> & {
  reservees: number;
  /** Prix effectif : prix du départ, sinon celui du circuit. */
  prix: number;
};

function toRow({ reservations, ...session }: DepartListPayload): DepartRow {
  return {
    ...session,
    reservees: placesReservees(reservations),
    prix: session.prixParPersonne ?? session.circuit.prixParPersonne,
  };
}

/**
 * RG 11, volet « temps » : les départs dont la date de fin est passée deviennent TERMINEE.
 * Appelé avant chaque lecture de liste ou de fiche ; idempotent.
 */
export async function syncTermines(db: Db, now: Date = new Date()): Promise<void> {
  await db.sessionDepart.updateMany({
    where: { statut: { in: ["OUVERTE", "COMPLETE"] }, dateFin: { lt: calendarDate(now) } },
    data: { statut: "TERMINEE" },
  });
}

/**
 * RG 11 : recalcule et enregistre le statut d'un départ (OUVERTE ↔ COMPLETE, TERMINEE).
 * À appeler dans la transaction de tout changement de places ou de réservations (E9 aussi).
 */
export async function refreshSessionStatut(
  db: Db,
  sessionId: string,
  now: Date = new Date(),
): Promise<StatutSession | null> {
  const session = await db.sessionDepart.findUnique({
    where: { id: sessionId },
    select: { statut: true, dateFin: true, placesTotal: true, reservations: reservationsActives },
  });
  if (!session) return null;
  const statut = computeSessionStatut(
    session,
    placesReservees(session.reservations),
    calendarDate(now),
  );
  if (statut !== session.statut) {
    await db.sessionDepart.update({ where: { id: sessionId }, data: { statut } });
  }
  return statut;
}

/** Fiche guide reliée à un compte GUIDE (null si le compte n'a pas de fiche). */
export async function findGuideFiche(db: TenantDb, utilisateurId: string) {
  return db.guide.findFirst({ where: { utilisateurId }, select: { id: true } });
}

export type ListDepartsFilters = {
  periode: DepartFilters["periode"];
  circuitId?: string;
  statut?: StatutSession;
  /** Vue d'un GUIDE : uniquement les départs qu'il encadre. */
  guideId?: string;
};

export async function listDeparts(
  db: TenantDb,
  filters: ListDepartsFilters,
  page: number,
  now: Date = new Date(),
): Promise<Paginated<DepartRow>> {
  await syncTermines(db, now);
  const today = calendarDate(now);
  const where: Prisma.SessionDepartWhereInput = {
    ...(filters.periode === "a-venir" ? { dateFin: { gte: today } } : {}),
    ...(filters.periode === "passes" ? { dateFin: { lt: today } } : {}),
    ...(filters.circuitId ? { circuitId: filters.circuitId } : {}),
    ...(filters.statut ? { statut: filters.statut } : {}),
    ...(filters.guideId ? { guideId: filters.guideId } : {}),
  };
  const [items, total] = await Promise.all([
    db.sessionDepart.findMany({
      where,
      select: departListSelect,
      // À venir : le plus proche d'abord ; passés : le plus récent d'abord.
      orderBy: [{ dateDebut: filters.periode === "passes" ? "desc" : "asc" }, { id: "asc" }],
      ...pageArgs(page),
    }),
    db.sessionDepart.count({ where }),
  ]);
  return { items: items.map(toRow), total, page, pageCount: pageCount(total) };
}

/** Prochains départs d'un circuit (section « Départs » de la fiche circuit). */
export async function listCircuitDeparts(
  db: TenantDb,
  circuitId: string,
  now: Date = new Date(),
): Promise<DepartRow[]> {
  await syncTermines(db, now);
  const items = await db.sessionDepart.findMany({
    where: { circuitId, dateFin: { gte: calendarDate(now) } },
    select: departListSelect,
    orderBy: { dateDebut: "asc" },
    take: 10,
  });
  return items.map(toRow);
}

const departDetailSelect = {
  ...departListSelect,
  notes: true,
  guideId: true,
  circuit: {
    select: { id: true, titre: true, prixParPersonne: true, capaciteMax: true, dureeJours: true },
  },
  guide: { select: { id: true, prenom: true, nom: true, telephone: true } },
  reservations: {
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      reference: true,
      nombrePersonnes: true,
      montantTotal: true,
      statut: true,
      createdAt: true,
      client: { select: { prenom: true, nom: true, email: true, telephone: true } },
      conversation: { select: { id: true } },
      participants: {
        select: { id: true, prenom: true, nom: true, age: true, nationalite: true },
      },
    },
  },
} satisfies Prisma.SessionDepartSelect;

type DepartDetailPayload = Prisma.SessionDepartGetPayload<{ select: typeof departDetailSelect }>;
export type DepartDetail = DepartDetailPayload & { reservees: number; prix: number };

export async function getDepart(
  db: TenantDb,
  id: string,
  now: Date = new Date(),
): Promise<DepartDetail | null> {
  await syncTermines(db, now);
  const session = await db.sessionDepart.findUnique({ where: { id }, select: departDetailSelect });
  if (!session) return null;
  return {
    ...session,
    reservees: placesReservees(session.reservations),
    prix: session.prixParPersonne ?? session.circuit.prixParPersonne,
  };
}

/* ─── Contrôles communs à la création et à la modification ───────────────────── */

type Periode = { dateDebut: Date; dateFin: Date };

/** Décision C : guide actif de l'agence, sans autre départ non annulé aux mêmes dates. */
async function checkGuide(
  tx: TenantTx,
  guideId: string,
  periode: Periode,
  excludeSessionId?: string,
): Promise<ServiceResult | null> {
  const guide = await tx.guide.findUnique({
    where: { id: guideId },
    select: { actif: true, prenom: true, nom: true },
  });
  if (!guide) return failure("Guide introuvable.", "guideId");
  if (!guide.actif) return failure("Ce guide est désactivé.", "guideId");
  const autres = await tx.sessionDepart.findMany({
    where: {
      guideId,
      statut: { not: "ANNULEE" },
      ...(excludeSessionId ? { id: { not: excludeSessionId } } : {}),
      dateDebut: { lte: periode.dateFin },
      dateFin: { gte: periode.dateDebut },
    },
    select: { dateDebut: true, dateFin: true, circuit: { select: { titre: true } } },
    take: 1,
  });
  const conflit = autres.find((s) => periodsOverlap(s, periode));
  if (conflit) {
    return failure(
      `${guide.prenom} ${guide.nom} encadre déjà « ${conflit.circuit.titre} » à ces dates.`,
      "guideId",
    );
  }
  return null;
}

/** Décision B : les places ne dépassent pas la capacité maximale du circuit. */
function checkCapacite(placesTotal: number, capaciteMax: number): ServiceResult | null {
  return placesTotal > capaciteMax
    ? failure(
        `Le circuit accueille au plus ${capaciteMax} personnes : réduisez le nombre de places.`,
        "placesTotal",
      )
    : null;
}

/* ─── Écritures ──────────────────────────────────────────────────────────────── */

export async function createDepart(
  db: TenantDb,
  agenceId: string,
  input: DepartInput,
  now: Date = new Date(),
): Promise<ServiceResult<{ id: string }>> {
  const periode = {
    dateDebut: parseIsoDate(input.dateDebut),
    dateFin: parseIsoDate(input.dateFin),
  };
  if (periode.dateDebut < calendarDate(now)) {
    return failure("La date de début ne peut pas être dans le passé.", "dateDebut");
  }
  const limite = await checkPlanLimit(db, "departs", now); // RG 18
  if (limite) return limite;
  return db.$tenantTransaction(async (tx) => {
    const circuit = await tx.circuit.findUnique({
      where: { id: input.circuitId },
      select: { statut: true, capaciteMax: true },
    });
    if (!circuit) return failure("Circuit introuvable.", "circuitId");
    if (circuit.statut === "ARCHIVE") {
      return failure("Ce circuit est archivé : aucun nouveau départ possible.", "circuitId");
    }
    const refus =
      checkCapacite(input.placesTotal, circuit.capaciteMax) ??
      (input.guideId ? await checkGuide(tx, input.guideId, periode) : null);
    if (refus && !refus.ok) return refus;

    const created = await tx.sessionDepart.create({
      data: {
        agenceId,
        circuitId: input.circuitId,
        guideId: input.guideId,
        ...periode,
        placesTotal: input.placesTotal,
        prixParPersonne: input.prixParPersonne,
        notes: input.notes,
        statut: "OUVERTE",
      },
      select: { id: true },
    });
    return success({ id: created.id });
  });
}

export async function updateDepart(
  db: TenantDb,
  id: string,
  input: UpdateDepartInput,
  now: Date = new Date(),
): Promise<ServiceResult> {
  const periode = {
    dateDebut: parseIsoDate(input.dateDebut),
    dateFin: parseIsoDate(input.dateFin),
  };
  return db.$tenantTransaction(async (tx) => {
    const session = await tx.sessionDepart.findUnique({
      where: { id },
      select: {
        statut: true,
        dateDebut: true,
        circuit: { select: { capaciteMax: true } },
        reservations: reservationsActives,
      },
    });
    if (!session) return failure("Départ introuvable.");
    if (session.statut === "ANNULEE" || session.statut === "TERMINEE") {
      return failure("Un départ annulé ou terminé ne peut plus être modifié.");
    }
    if (
      periode.dateDebut.getTime() !== session.dateDebut.getTime() &&
      periode.dateDebut < calendarDate(now)
    ) {
      return failure("La date de début ne peut pas être dans le passé.", "dateDebut");
    }
    const reservees = placesReservees(session.reservations);
    if (input.placesTotal < reservees) {
      return failure(
        `${reservees} place(s) déjà réservée(s) : impossible de descendre en dessous (RG 13).`,
        "placesTotal",
      );
    }
    const refus =
      checkCapacite(input.placesTotal, session.circuit.capaciteMax) ??
      (input.guideId ? await checkGuide(tx, input.guideId, periode, id) : null);
    if (refus && !refus.ok) return refus;

    await tx.sessionDepart.update({
      where: { id },
      data: {
        guideId: input.guideId,
        ...periode,
        placesTotal: input.placesTotal,
        prixParPersonne: input.prixParPersonne,
        notes: input.notes,
      },
    });
    // Changement de places ou de dates : OUVERTE ↔ COMPLETE, éventuellement TERMINEE.
    await refreshSessionStatut(tx, id, now);
    return success(undefined);
  });
}

/**
 * Décision D : annulation d'un départ. Ses réservations actives (en attente ou confirmées)
 * passent à ANNULEE, dans la même transaction : jamais de réservation « confirmée » sur un
 * départ annulé. Les remboursements éventuels relèvent de l'étape E10.
 */
export async function cancelDepart(
  db: TenantDb,
  id: string,
  now: Date = new Date(),
): Promise<ServiceResult<{ reservationsAnnulees: number }>> {
  return db.$tenantTransaction(async (tx) => {
    const session = await tx.sessionDepart.findUnique({ where: { id }, select: { statut: true } });
    if (!session) return failure("Départ introuvable.");
    if (session.statut === "ANNULEE") return failure("Ce départ est déjà annulé.");
    if (session.statut === "TERMINEE") return failure("Un départ terminé ne peut pas être annulé.");
    const touchees = await tx.reservation.findMany({
      where: { sessionId: id, statut: { in: ["EN_ATTENTE", "CONFIRMEE"] } },
      select: { id: true, reference: true },
    });
    const annulees = await tx.reservation.updateMany({
      where: { sessionId: id, statut: { in: ["EN_ATTENTE", "CONFIRMEE"] } },
      data: { statut: "ANNULEE", annuleeAt: now },
    });
    for (const r of touchees) {
      await notifyReservationClient(tx, r.id, {
        type: "DEPART",
        titre: `Départ annulé · ${r.reference}`,
        message:
          "L'agence a annulé ce départ : votre réservation est annulée et les paiements déjà versés vous seront remboursés.",
      });
    }
    await tx.sessionDepart.update({ where: { id }, data: { statut: "ANNULEE" } });
    return success({ reservationsAnnulees: annulees.count });
  });
}

/** Suppression définitive, seulement si le départ n'a jamais reçu de réservation. */
export async function deleteDepart(db: TenantDb, id: string): Promise<ServiceResult> {
  const session = await db.sessionDepart.findUnique({
    where: { id },
    select: { _count: { select: { reservations: true } } },
  });
  if (!session) return failure("Départ introuvable.");
  if (session._count.reservations > 0) {
    return failure("Ce départ a déjà des réservations : annulez-le plutôt que de le supprimer.");
  }
  await db.sessionDepart.delete({ where: { id } });
  return success(undefined);
}

/**
 * Options du formulaire « Programmer un départ » : circuits publiés ou brouillons (décision A,
 * pas les archivés), guides actifs, date du jour à Madagascar (borne des champs date).
 */
export async function departFormOptions(db: TenantDb, now: Date = new Date()) {
  const [circuits, guides] = await Promise.all([
    db.circuit.findMany({
      where: { statut: { not: "ARCHIVE" } },
      orderBy: { titre: "asc" },
      select: { id: true, titre: true, dureeJours: true, capaciteMax: true, prixParPersonne: true },
    }),
    db.guide.findMany({
      where: { actif: true },
      orderBy: [{ nom: "asc" }, { prenom: "asc" }],
      select: { id: true, prenom: true, nom: true },
    }),
  ]);
  return {
    circuits,
    guides: guides.map((g) => ({ id: g.id, label: `${g.prenom} ${g.nom}` })),
    today: toIsoDate(calendarDate(now)),
  };
}
