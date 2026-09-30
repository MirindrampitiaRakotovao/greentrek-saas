import type {
  MethodePaiement,
  Prisma,
  StatutPaiement,
  StatutReservation,
} from "@/generated/prisma/client";
import { calendarDate } from "@/lib/dates";
import { type Paginated, pageArgs, pageCount } from "@/lib/pagination";
import { refreshSessionStatut } from "@/lib/services/departs";
import { lockReservation, montantPaye } from "@/lib/services/reservations";
import { notifyReservationClient } from "@/lib/services/notifications";
import { failure, type ServiceResult, success } from "@/lib/services/result";
import type { TenantDb, TenantTx } from "@/lib/tenant";

/**
 * Gestion des réservations et des paiements par l'agence (§7.3, étape E10).
 *
 * Mêmes règles que côté client (E9), sous le même verrou de ligne (`lockReservation`) :
 * une action de l'agence et une action du client sur la même réservation ne se croisent pas.
 * - RG 15 : annulation seulement si le départ n'a pas commencé.
 * - RG 16 : la somme des paiements valides ne dépasse jamais le montant total.
 * - Décision A : l'agence peut confirmer une réservation non entièrement payée (paiement sur
 *   place) ; le reste à payer reste affiché.
 * - Décision B : une réservation CONFIRMEE passe TERMINEE quand son départ est terminé.
 * - Décision C : remboursement (simulé) des paiements validés d'une réservation annulée.
 * - Décision D : pas de suppression d'une réservation (traçabilité), seulement l'annulation.
 */

/** Décision B : réservations confirmées dont le départ est terminé → TERMINEE (idempotent). */
export async function syncReservationsTerminees(db: TenantDb, now: Date = new Date()) {
  await db.reservation.updateMany({
    where: { statut: "CONFIRMEE", session: { dateFin: { lt: calendarDate(now) } } },
    data: { statut: "TERMINEE" },
  });
}

/* ─── Lectures ───────────────────────────────────────────────────────────────── */

export const PERIODES_RESERVATION = ["a-venir", "passes", "tous"] as const;
export type ReservationFilters = {
  statut?: StatutReservation;
  circuitId?: string;
  periode: (typeof PERIODES_RESERVATION)[number];
  /** Référence ou nom / e-mail du client. */
  q?: string;
};

function reservationWhere(f: ReservationFilters, now: Date): Prisma.ReservationWhereInput {
  const today = calendarDate(now);
  const q = f.q?.trim();
  // Conditions sur le départ (circuit et période), réunies dans un seul filtre.
  const session: Prisma.SessionDepartWhereInput = {
    ...(f.circuitId ? { circuitId: f.circuitId } : {}),
    ...(f.periode === "a-venir" ? { dateFin: { gte: today } } : {}),
    ...(f.periode === "passes" ? { dateFin: { lt: today } } : {}),
  };
  return {
    ...(f.statut ? { statut: f.statut } : {}),
    ...(Object.keys(session).length ? { session } : {}),
    ...(q
      ? {
          OR: [
            { reference: { contains: q } },
            { client: { nom: { contains: q } } },
            { client: { prenom: { contains: q } } },
            { client: { email: { contains: q } } },
          ],
        }
      : {}),
  };
}

const reservationRowSelect = {
  id: true,
  reference: true,
  statut: true,
  nombrePersonnes: true,
  montantTotal: true,
  createdAt: true,
  client: { select: { id: true, prenom: true, nom: true, email: true } },
  session: {
    select: {
      id: true,
      dateDebut: true,
      dateFin: true,
      circuit: { select: { id: true, titre: true } },
    },
  },
  paiements: { select: { montant: true, statut: true } },
} satisfies Prisma.ReservationSelect;

type ReservationRowPayload = Prisma.ReservationGetPayload<{
  select: typeof reservationRowSelect;
}>;
export type ReservationRow = Omit<ReservationRowPayload, "paiements"> & {
  paye: number;
  paiementsEnAttente: number;
};

function toRow({ paiements, ...r }: ReservationRowPayload): ReservationRow {
  return {
    ...r,
    paye: montantPaye(paiements),
    paiementsEnAttente: paiements.filter((p) => p.statut === "EN_ATTENTE").length,
  };
}

export async function listReservations(
  db: TenantDb,
  filters: ReservationFilters,
  page: number,
  now: Date = new Date(),
): Promise<Paginated<ReservationRow>> {
  await syncReservationsTerminees(db, now);
  const where = reservationWhere(filters, now);
  const [items, total] = await Promise.all([
    db.reservation.findMany({
      where,
      select: reservationRowSelect,
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      ...pageArgs(page),
    }),
    db.reservation.count({ where }),
  ]);
  return { items: items.map(toRow), total, page, pageCount: pageCount(total) };
}

/** Toutes les réservations filtrées, sans pagination (export CSV). */
export async function exportReservations(
  db: TenantDb,
  filters: ReservationFilters,
  now: Date = new Date(),
): Promise<ReservationRow[]> {
  await syncReservationsTerminees(db, now);
  const items = await db.reservation.findMany({
    where: reservationWhere(filters, now),
    select: reservationRowSelect,
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
  });
  return items.map(toRow);
}

export type ATraiter = {
  /** Réservations en attente dont le départ n'a pas commencé. */
  enAttente: number;
  /** Paiements (virement, espèces) à valider. */
  paiementsAValider: number;
  /** Réservations encore en attente alors que le départ a commencé (décision B). */
  aRegulariser: number;
  /** Réservations annulées avec des paiements validés à rembourser (décision C). */
  aRembourser: number;
};

export async function countATraiter(db: TenantDb, now: Date = new Date()): Promise<ATraiter> {
  const today = calendarDate(now);
  const [enAttente, paiementsAValider, aRegulariser, aRembourser] = await Promise.all([
    db.reservation.count({
      where: { statut: "EN_ATTENTE", session: { dateDebut: { gt: today } } },
    }),
    db.paiement.count({ where: { statut: "EN_ATTENTE" } }),
    db.reservation.count({
      where: { statut: "EN_ATTENTE", session: { dateDebut: { lte: today } } },
    }),
    db.reservation.count({
      where: { statut: "ANNULEE", paiements: { some: { statut: "VALIDE" } } },
    }),
  ]);
  return { enAttente, paiementsAValider, aRegulariser, aRembourser };
}

const reservationDetailSelect = {
  id: true,
  reference: true,
  statut: true,
  nombrePersonnes: true,
  montantTotal: true,
  remarques: true,
  createdAt: true,
  confirmeeAt: true,
  annuleeAt: true,
  client: { select: { id: true, prenom: true, nom: true, email: true, telephone: true } },
  session: {
    select: {
      id: true,
      dateDebut: true,
      dateFin: true,
      statut: true,
      circuit: { select: { id: true, titre: true } },
      guide: { select: { prenom: true, nom: true } },
    },
  },
  participants: {
    orderBy: { id: "asc" },
    select: {
      id: true,
      prenom: true,
      nom: true,
      age: true,
      nationalite: true,
      contactUrgence: true,
    },
  },
  paiements: {
    orderBy: { id: "asc" },
    select: {
      id: true,
      montant: true,
      methode: true,
      statut: true,
      referenceExterne: true,
      payeLe: true,
    },
  },
  conversation: { select: { id: true } },
} satisfies Prisma.ReservationSelect;

type ReservationDetailPayload = Prisma.ReservationGetPayload<{
  select: typeof reservationDetailSelect;
}>;
export type ReservationDetail = ReservationDetailPayload & {
  paye: number;
  reste: number;
  /** Actions possibles pour l'agence à cet instant. */
  peutConfirmer: boolean;
  peutAnnuler: boolean;
  peutEncaisser: boolean;
};

export async function getReservation(
  db: TenantDb,
  id: string,
  now: Date = new Date(),
): Promise<ReservationDetail | null> {
  await syncReservationsTerminees(db, now);
  const r = await db.reservation.findUnique({ where: { id }, select: reservationDetailSelect });
  if (!r) return null;
  const paye = montantPaye(r.paiements);
  const active = r.statut === "EN_ATTENTE" || r.statut === "CONFIRMEE";
  return {
    ...r,
    paye,
    reste: Math.max(0, r.montantTotal - paye),
    peutConfirmer: r.statut === "EN_ATTENTE" && r.session.statut !== "ANNULEE",
    peutAnnuler: active && r.session.dateDebut > calendarDate(now),
    peutEncaisser: r.statut !== "ANNULEE" && paye < r.montantTotal,
  };
}

/* ─── Actions ────────────────────────────────────────────────────────────────── */

/** Lit la réservation verrouillée (dans la transaction) avec ses paiements. */
async function lockedReservation(tx: TenantTx, id: string) {
  if (!(await lockReservation(tx, id))) return null;
  return tx.reservation.findUnique({
    where: { id },
    select: {
      reference: true,
      statut: true,
      montantTotal: true,
      sessionId: true,
      session: { select: { dateDebut: true, statut: true } },
      paiements: { select: { id: true, montant: true, statut: true } },
    },
  });
}

/** Décision A : confirmation d'une réservation en attente, même non entièrement payée. */
export async function confirmReservation(
  db: TenantDb,
  id: string,
  now: Date = new Date(),
): Promise<ServiceResult> {
  return db.$tenantTransaction(async (tx) => {
    const r = await lockedReservation(tx, id);
    if (!r) return failure("Réservation introuvable.");
    if (r.statut !== "EN_ATTENTE") return failure("Seule une réservation en attente se confirme.");
    if (r.session.statut === "ANNULEE")
      return failure("Le départ de cette réservation est annulé.");
    await tx.reservation.update({
      where: { id },
      data: { statut: "CONFIRMEE", confirmeeAt: now },
    });
    await notifyReservationClient(tx, id, {
      type: "RESERVATION",
      titre: `Réservation ${r.reference} confirmée`,
      message: "L'agence a confirmé votre réservation. Bon voyage !",
    });
    return success(undefined);
  });
}

/**
 * Annulation par l'agence (RG 15 : départ pas encore commencé). Places libérées, statut du
 * départ recalculé ; paiement en attente abandonné ; paiements validés à rembourser (C).
 */
export async function cancelReservationByAgency(
  db: TenantDb,
  id: string,
  now: Date = new Date(),
): Promise<ServiceResult> {
  return db.$tenantTransaction(async (tx) => {
    const r = await lockedReservation(tx, id);
    if (!r) return failure("Réservation introuvable.");
    if (r.statut !== "EN_ATTENTE" && r.statut !== "CONFIRMEE") {
      return failure("Cette réservation ne peut plus être annulée.");
    }
    if (r.session.dateDebut <= calendarDate(now)) {
      return failure("Le départ a commencé : la réservation ne peut plus être annulée (RG 15).");
    }
    await tx.reservation.update({ where: { id }, data: { statut: "ANNULEE", annuleeAt: now } });
    await tx.paiement.updateMany({
      where: { reservationId: id, statut: "EN_ATTENTE" },
      data: { statut: "ECHOUE" },
    });
    await refreshSessionStatut(tx, r.sessionId, now);
    await notifyReservationClient(tx, id, {
      type: "ANNULATION",
      titre: `Réservation ${r.reference} annulée`,
      message:
        "L'agence a annulé votre réservation. Les paiements déjà versés vous seront remboursés.",
    });
    return success(undefined);
  });
}

/** Si la réservation en attente est entièrement payée, elle passe CONFIRMEE. */
async function confirmIfPaid(
  tx: TenantTx,
  id: string,
  statut: StatutReservation,
  montantTotal: number,
  paye: number,
  now: Date,
): Promise<boolean> {
  if (statut !== "EN_ATTENTE" || paye < montantTotal) return false;
  await tx.reservation.update({ where: { id }, data: { statut: "CONFIRMEE", confirmeeAt: now } });
  return true;
}

/**
 * Paiement reçu à l'agence (espèces, virement…) : enregistré VALIDE. Paiement partiel
 * possible (acompte), jamais au-delà du reste à payer (RG 16).
 */
export async function recordPayment(
  db: TenantDb,
  input: { reservationId: string; montant: number; methode: MethodePaiement },
  now: Date = new Date(),
): Promise<ServiceResult<{ confirmee: boolean }>> {
  return db.$tenantTransaction(async (tx) => {
    const r = await lockedReservation(tx, input.reservationId);
    if (!r) return failure("Réservation introuvable.");
    if (r.statut === "ANNULEE") return failure("Réservation annulée : aucun encaissement.");
    const reste = r.montantTotal - montantPaye(r.paiements);
    if (input.montant > reste) {
      return failure(
        reste > 0
          ? `Le montant dépasse le reste à payer (RG 16).`
          : "Cette réservation est déjà entièrement payée.",
        "montant",
      );
    }
    await tx.paiement.create({
      data: {
        reservationId: input.reservationId,
        montant: input.montant,
        methode: input.methode,
        statut: "VALIDE",
        referenceExterne: "AGENCE",
        payeLe: now,
      },
    });
    const confirmee = await confirmIfPaid(
      tx,
      input.reservationId,
      r.statut,
      r.montantTotal,
      montantPaye(r.paiements) + input.montant,
      now,
    );
    await notifyReservationClient(tx, input.reservationId, {
      type: "PAIEMENT",
      titre: `Paiement reçu · ${r.reference}`,
      message: confirmee
        ? "Votre réservation est entièrement payée et confirmée."
        : "L'agence a enregistré votre paiement.",
    });
    return success({ confirmee });
  });
}

/** Paiement d'une réservation donné, pour les actions qui partent d'un paiement. */
async function paymentReservationId(db: TenantDb, paiementId: string) {
  const p = await db.paiement.findUnique({
    where: { id: paiementId },
    select: { reservationId: true },
  });
  return p?.reservationId ?? null;
}

/** Validation d'un paiement en attente (virement, espèces annoncés par le client). */
export async function validatePayment(
  db: TenantDb,
  paiementId: string,
  now: Date = new Date(),
): Promise<ServiceResult<{ confirmee: boolean }>> {
  const reservationId = await paymentReservationId(db, paiementId);
  if (!reservationId) return failure("Paiement introuvable.");
  return db.$tenantTransaction(async (tx) => {
    const r = await lockedReservation(tx, reservationId);
    if (!r) return failure("Réservation introuvable.");
    const p = r.paiements.find((x) => x.id === paiementId);
    if (p?.statut !== "EN_ATTENTE") return failure("Ce paiement n'est pas en attente.");
    if (r.statut === "ANNULEE") return failure("Réservation annulée : refusez ce paiement.");
    const paye = montantPaye(r.paiements);
    if (paye + p.montant > r.montantTotal) {
      return failure("Ce paiement dépasserait le montant total (RG 16).");
    }
    await tx.paiement.update({
      where: { id: paiementId },
      data: { statut: "VALIDE", payeLe: now },
    });
    const confirmee = await confirmIfPaid(
      tx,
      reservationId,
      r.statut,
      r.montantTotal,
      paye + p.montant,
      now,
    );
    await notifyReservationClient(tx, reservationId, {
      type: "PAIEMENT",
      titre: `Paiement validé · ${r.reference}`,
      message: confirmee
        ? "Votre paiement a été reçu : la réservation est confirmée."
        : "Votre paiement a été reçu.",
    });
    return success({ confirmee });
  });
}

async function changePaymentStatus(
  db: TenantDb,
  paiementId: string,
  from: StatutPaiement,
  to: StatutPaiement,
  guard: (reservationStatut: StatutReservation) => string | null,
): Promise<ServiceResult> {
  const reservationId = await paymentReservationId(db, paiementId);
  if (!reservationId) return failure("Paiement introuvable.");
  return db.$tenantTransaction(async (tx) => {
    const r = await lockedReservation(tx, reservationId);
    if (!r) return failure("Réservation introuvable.");
    const p = r.paiements.find((x) => x.id === paiementId);
    if (p?.statut !== from) return failure("Ce paiement a déjà été traité.");
    const refus = guard(r.statut);
    if (refus) return failure(refus);
    await tx.paiement.update({ where: { id: paiementId }, data: { statut: to } });
    await notifyReservationClient(tx, reservationId, {
      type: "PAIEMENT",
      titre:
        to === "REMBOURSE"
          ? `Remboursement · ${r.reference}`
          : `Paiement non reçu · ${r.reference}`,
      message:
        to === "REMBOURSE"
          ? "L'agence a procédé au remboursement de votre paiement."
          : "L'agence n'a pas reçu votre paiement : vous pouvez payer à nouveau depuis votre réservation.",
    });
    return success(undefined);
  });
}

/** Refus d'un paiement en attente (virement jamais reçu…) : le client pourra repayer. */
export function rejectPayment(db: TenantDb, paiementId: string): Promise<ServiceResult> {
  return changePaymentStatus(db, paiementId, "EN_ATTENTE", "ECHOUE", () => null);
}

/** Décision C : remboursement (simulé) d'un paiement validé d'une réservation annulée. */
export function refundPayment(db: TenantDb, paiementId: string): Promise<ServiceResult> {
  return changePaymentStatus(db, paiementId, "VALIDE", "REMBOURSE", (statut) =>
    statut === "ANNULEE" ? null : "Seuls les paiements d'une réservation annulée se remboursent.",
  );
}

/* ─── Paiements ──────────────────────────────────────────────────────────────── */

export type PaiementFilters = { statut?: StatutPaiement; methode?: MethodePaiement };

const paiementRowSelect = {
  id: true,
  montant: true,
  methode: true,
  statut: true,
  referenceExterne: true,
  payeLe: true,
  reservation: {
    select: {
      id: true,
      reference: true,
      statut: true,
      createdAt: true,
      client: { select: { prenom: true, nom: true } },
    },
  },
} satisfies Prisma.PaiementSelect;

export type PaiementRow = Prisma.PaiementGetPayload<{ select: typeof paiementRowSelect }>;

export async function listPaiements(
  db: TenantDb,
  filters: PaiementFilters,
  page: number,
): Promise<Paginated<PaiementRow>> {
  const where: Prisma.PaiementWhereInput = {
    ...(filters.statut ? { statut: filters.statut } : {}),
    ...(filters.methode ? { methode: filters.methode } : {}),
  };
  const [items, total] = await Promise.all([
    db.paiement.findMany({
      where,
      select: paiementRowSelect,
      // Paiements à valider d'abord (énumération : EN_ATTENTE en premier), puis les plus récents.
      orderBy: [{ statut: "asc" }, { payeLe: "desc" }, { id: "desc" }],
      ...pageArgs(page),
    }),
    db.paiement.count({ where }),
  ]);
  return { items, total, page, pageCount: pageCount(total) };
}
