import { Prisma, type StatutPaiement } from "@/generated/prisma/client";
import { calendarDate } from "@/lib/dates";
import { formatDate } from "@/lib/format";
import { firstBookableDate, placesReservees } from "@/lib/departs";
import { generateReference, referencePrefix } from "@/lib/reference";
import { refreshSessionStatut } from "@/lib/services/departs";
import { notifyAgencyStaff } from "@/lib/services/notifications";
import { failure, type ServiceResult, success } from "@/lib/services/result";
import type { TenantDb, TenantTx } from "@/lib/tenant";
import {
  NUMERO_REFUSE_SUFFIXE,
  PAIEMENT_IMMEDIAT,
  type PaiementInput,
  type ReservationInput,
} from "@/lib/validators/reservations";

/**
 * Réservations des clients (§7.2) et paiement simulé (§5.2, tables 8, 12 et 13).
 *
 * - RG 12 : une réservation concerne un seul client et un seul départ, au moins une personne.
 * - RG 13 (anti-surbooking) : le total réservé sur un départ ne dépasse jamais `placesTotal`,
 *   même avec des réservations simultanées. Voir `lockSession`.
 * - RG 14 : le montant est calculé ici (prix × personnes) et n'est plus modifié ensuite.
 * - RG 15 : annulation possible tant que le départ n'a pas commencé.
 * - RG 16 : la somme des paiements valides ne dépasse pas le montant total.
 * - RG 11 : le statut du départ est recalculé dans la même transaction (COMPLETE ↔ OUVERTE).
 */

/**
 * Verrou pessimiste sur la ligne du départ, pour la durée de la transaction.
 *
 * Le problème : deux clients réservent les 2 dernières places au même instant ; chacun lit
 * « 2 places libres », puis chacun crée sa réservation : 4 places vendues pour 2 (surbooking).
 * La solution : ÉCRIRE d'abord sur la ligne du départ (mise à jour neutre `+ 0`). Avec InnoDB
 * (MySQL), toute écriture pose un verrou exclusif sur la ligne jusqu'à la fin de la
 * transaction : la seconde transaction attend donc la fin de la première avant de pouvoir
 * compter les places, et voit alors la réservation déjà créée.
 * Pourquoi pas `SELECT … FOR UPDATE` : le client confiné interdit le SQL brut (isolation
 * entre agences) ; l'écriture neutre donne le même verrou en restant filtrée par agence.
 */
async function lockSession(tx: TenantTx, sessionId: string): Promise<boolean> {
  const locked = await tx.sessionDepart.updateMany({
    where: { id: sessionId },
    data: { placesTotal: { increment: 0 } },
  });
  return locked.count === 1;
}

/** Même principe pour une réservation (paiement, annulation) : une opération à la fois. */
export async function lockReservation(tx: TenantTx, reservationId: string, clientId?: string) {
  const locked = await tx.reservation.updateMany({
    where: { id: reservationId, ...(clientId ? { clientId } : {}) },
    data: { nombrePersonnes: { increment: 0 } },
  });
  return locked.count === 1;
}

/** Somme des paiements VALIDÉS (RG 16 : ne dépasse jamais le montant total). */
export function montantPaye(paiements: readonly { montant: number; statut: StatutPaiement }[]) {
  return paiements.filter((p) => p.statut === "VALIDE").reduce((total, p) => total + p.montant, 0);
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export type CreateReservationInput = ReservationInput & {
  agenceId: string;
  agenceSlug: string;
  clientId: string;
};

/** Création d'une réservation EN_ATTENTE et de ses participants, sans surbooking possible. */
export async function createReservation(
  db: TenantDb,
  input: CreateReservationInput,
  now: Date = new Date(),
): Promise<ServiceResult<{ id: string; reference: string }>> {
  const nombrePersonnes = input.participants.length;
  // Référence unique : en cas (très improbable) de collision, nouvel essai.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const reference = generateReference(referencePrefix(input.agenceSlug), now.getUTCFullYear());
    try {
      return await db.$tenantTransaction(async (tx) => {
        if (!(await lockSession(tx, input.sessionId))) return failure("Départ introuvable.");
        const session = await tx.sessionDepart.findUnique({
          where: { id: input.sessionId },
          select: {
            statut: true,
            dateDebut: true,
            placesTotal: true,
            prixParPersonne: true,
            circuit: { select: { statut: true, prixParPersonne: true } },
            reservations: {
              where: { statut: { not: "ANNULEE" } },
              select: { nombrePersonnes: true, statut: true },
            },
          },
        });
        // Mêmes conditions que le site vitrine : départ ouvert, pas commencé, circuit publié.
        if (
          !session ||
          session.circuit.statut !== "PUBLIE" ||
          session.dateDebut < firstBookableDate(calendarDate(now)) ||
          session.statut !== "OUVERTE"
        ) {
          return failure("Ce départ n'est plus ouvert à la réservation.");
        }
        const libres = session.placesTotal - placesReservees(session.reservations);
        if (nombrePersonnes > libres) {
          return failure(
            libres > 0
              ? `Il ne reste que ${libres} place${libres > 1 ? "s" : ""} sur ce départ.`
              : "Ce départ est désormais complet.",
            "participants",
          );
        }
        const prix = session.prixParPersonne ?? session.circuit.prixParPersonne;
        const reservation = await tx.reservation.create({
          data: {
            agenceId: input.agenceId,
            reference,
            clientId: input.clientId,
            sessionId: input.sessionId,
            nombrePersonnes,
            montantTotal: prix * nombrePersonnes, // RG 14 : figé à la création
            statut: "EN_ATTENTE",
            remarques: input.remarques,
            createdAt: now,
          },
          select: { id: true, reference: true },
        });
        await tx.participant.createMany({
          data: input.participants.map((p) => ({ ...p, reservationId: reservation.id })),
        });
        await refreshSessionStatut(tx, input.sessionId, now); // RG 11
        await notifyAgencyStaff(tx, {
          type: "RESERVATION",
          titre: `Nouvelle réservation ${reservation.reference}`,
          message: `${nombrePersonnes} personne${nombrePersonnes > 1 ? "s" : ""} · départ du ${formatDate(session.dateDebut)}`,
          lienUrl: `/dashboard/reservations/${reservation.id}`,
        });
        return success(reservation);
      });
    } catch (error: unknown) {
      if (isUniqueViolation(error) && attempt < 2) continue;
      throw error;
    }
  }
  throw new Error("Référence de réservation : collisions répétées.");
}

export type PaymentOutcome = { statut: StatutPaiement; confirmee: boolean };

/**
 * Paiement simulé du reste à payer (décision A de l'étape E9) :
 * - carte ou Mobile Money : accepté immédiatement, sauf numéro de test finissant par 0000
 *   (refus simulé) ; la réservation est CONFIRMEE quand elle est entièrement payée ;
 * - virement ou espèces : paiement EN_ATTENTE, à valider par l'agence (étape E10).
 * Seuls les 4 derniers chiffres du numéro sont conservés (référence du paiement).
 */
export async function payReservation(
  db: TenantDb,
  input: PaiementInput & { clientId?: string },
  now: Date = new Date(),
): Promise<ServiceResult<PaymentOutcome>> {
  return db.$tenantTransaction(async (tx) => {
    if (!(await lockReservation(tx, input.reservationId, input.clientId))) {
      return failure("Réservation introuvable.");
    }
    const reservation = await tx.reservation.findUnique({
      where: { id: input.reservationId },
      select: {
        reference: true,
        statut: true,
        montantTotal: true,
        paiements: { select: { montant: true, statut: true } },
      },
    });
    if (!reservation) return failure("Réservation introuvable.");
    if (reservation.statut !== "EN_ATTENTE") {
      return failure(
        reservation.statut === "CONFIRMEE"
          ? "Cette réservation est déjà payée et confirmée."
          : "Cette réservation ne peut plus être payée.",
      );
    }
    if (reservation.paiements.some((p) => p.statut === "EN_ATTENTE")) {
      return failure("Un paiement est déjà en attente de validation par l'agence.");
    }
    const dejaPaye = reservation.paiements
      .filter((p) => p.statut === "VALIDE")
      .reduce((total, p) => total + p.montant, 0);
    const reste = reservation.montantTotal - dejaPaye; // RG 16 : jamais au-delà du montant
    if (reste <= 0) return failure("Cette réservation est déjà entièrement payée.");

    const immediat = PAIEMENT_IMMEDIAT.includes(input.methode);
    const refuse = immediat && (input.numero ?? "").endsWith(NUMERO_REFUSE_SUFFIXE);
    const statut: StatutPaiement = !immediat ? "EN_ATTENTE" : refuse ? "ECHOUE" : "VALIDE";
    await tx.paiement.create({
      data: {
        reservationId: input.reservationId,
        montant: reste,
        methode: input.methode,
        statut,
        referenceExterne: input.numero ? `•••• ${input.numero.slice(-4)}` : null,
        payeLe: statut === "VALIDE" ? now : null,
      },
    });
    const confirmee = statut === "VALIDE"; // le reste est payé en entier
    if (confirmee) {
      await tx.reservation.update({
        where: { id: input.reservationId },
        data: { statut: "CONFIRMEE", confirmeeAt: now },
      });
    }
    if (statut !== "ECHOUE") {
      await notifyAgencyStaff(tx, {
        type: "PAIEMENT",
        titre: confirmee
          ? `Réservation ${reservation.reference} payée`
          : `Paiement à valider · ${reservation.reference}`,
        message: confirmee
          ? "Paiement en ligne reçu : la réservation est confirmée."
          : "Virement ou espèces annoncés par le client : à valider à réception.",
        lienUrl: `/dashboard/reservations/${input.reservationId}`,
      });
    }
    return success({ statut, confirmee });
  });
}

/**
 * Annulation par le client (RG 15 : seulement si le départ n'a pas commencé ; décision D :
 * jusqu'à la veille du départ). Les places sont libérées et le statut du départ recalculé.
 * Un paiement en attente (virement, espèces) est abandonné ; les paiements déjà validés
 * sont remboursés par l'agence (étape E10).
 */
export async function cancelReservationByClient(
  db: TenantDb,
  input: { reservationId: string; clientId: string },
  now: Date = new Date(),
): Promise<ServiceResult> {
  return db.$tenantTransaction(async (tx) => {
    if (!(await lockReservation(tx, input.reservationId, input.clientId))) {
      return failure("Réservation introuvable.");
    }
    const reservation = await tx.reservation.findUnique({
      where: { id: input.reservationId },
      select: {
        reference: true,
        statut: true,
        sessionId: true,
        session: { select: { dateDebut: true } },
      },
    });
    if (!reservation) return failure("Réservation introuvable.");
    if (reservation.statut !== "EN_ATTENTE" && reservation.statut !== "CONFIRMEE") {
      return failure("Cette réservation ne peut plus être annulée.");
    }
    if (reservation.session.dateDebut <= calendarDate(now)) {
      return failure("Le départ a commencé : la réservation ne peut plus être annulée (RG 15).");
    }
    await tx.reservation.update({
      where: { id: input.reservationId },
      data: { statut: "ANNULEE", annuleeAt: now },
    });
    await tx.paiement.updateMany({
      where: { reservationId: input.reservationId, statut: "EN_ATTENTE" },
      data: { statut: "ECHOUE" },
    });
    await refreshSessionStatut(tx, reservation.sessionId, now); // places libérées (RG 11)
    await notifyAgencyStaff(tx, {
      type: "ANNULATION",
      titre: `Réservation ${reservation.reference} annulée par le client`,
      message: "Les places ont été libérées ; vérifiez s'il faut rembourser un paiement.",
      lienUrl: `/dashboard/reservations/${input.reservationId}`,
    });
    return success(undefined);
  });
}

/* ─── Lectures de l'espace client ────────────────────────────────────────────── */

const reservationSelect = {
  id: true,
  reference: true,
  nombrePersonnes: true,
  montantTotal: true,
  statut: true,
  remarques: true,
  createdAt: true,
  confirmeeAt: true,
  annuleeAt: true,
  session: {
    select: {
      id: true,
      dateDebut: true,
      dateFin: true,
      circuit: { select: { titre: true, slug: true, imagePrincipaleUrl: true } },
    },
  },
  participants: {
    orderBy: { id: "asc" },
    select: { id: true, prenom: true, nom: true, age: true, nationalite: true },
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
  avis: { select: { note: true, commentaire: true, statut: true } },
} satisfies Prisma.ReservationSelect;

type ReservationPayload = Prisma.ReservationGetPayload<{ select: typeof reservationSelect }>;

export type ClientReservation = ReservationPayload & {
  paye: number;
  reste: number;
  /** Actions possibles pour le client à cet instant. */
  peutPayer: boolean;
  peutAnnuler: boolean;
  /** RG 17 : séjour terminé et pas encore d'avis. */
  peutDonnerAvis: boolean;
};

function toClientReservation(r: ReservationPayload, now: Date): ClientReservation {
  const paye = r.paiements
    .filter((p) => p.statut === "VALIDE")
    .reduce((total, p) => total + p.montant, 0);
  const active = r.statut === "EN_ATTENTE" || r.statut === "CONFIRMEE";
  return {
    ...r,
    paye,
    reste: Math.max(0, r.montantTotal - paye),
    peutPayer:
      r.statut === "EN_ATTENTE" &&
      paye < r.montantTotal &&
      !r.paiements.some((p) => p.statut === "EN_ATTENTE"),
    peutAnnuler: active && r.session.dateDebut > calendarDate(now),
    peutDonnerAvis: r.statut === "TERMINEE" && r.avis === null,
  };
}

/**
 * Décision B de l'étape E10, limitée aux réservations du client : une réservation confirmée
 * dont le départ est fini passe à TERMINEE (ce qui ouvre le dépôt d'un avis, RG 17).
 */
async function syncClientTerminees(db: TenantDb, clientId: string, now: Date) {
  await db.reservation.updateMany({
    where: { clientId, statut: "CONFIRMEE", session: { dateFin: { lt: calendarDate(now) } } },
    data: { statut: "TERMINEE" },
  });
}

/** Réservations d'un client : les siennes uniquement (§7.2), les plus récentes d'abord. */
export async function listClientReservations(
  db: TenantDb,
  clientId: string,
  now: Date = new Date(),
): Promise<ClientReservation[]> {
  await syncClientTerminees(db, clientId, now);
  const items = await db.reservation.findMany({
    where: { clientId },
    orderBy: { createdAt: "desc" },
    select: reservationSelect,
  });
  return items.map((r) => toClientReservation(r, now));
}

/** Une réservation du client (null si elle n'existe pas ou appartient à un autre client). */
export async function getClientReservation(
  db: TenantDb,
  reservationId: string,
  clientId: string,
  now: Date = new Date(),
): Promise<ClientReservation | null> {
  await syncClientTerminees(db, clientId, now);
  const r = await db.reservation.findFirst({
    where: { id: reservationId, clientId },
    select: reservationSelect,
  });
  return r ? toClientReservation(r, now) : null;
}
