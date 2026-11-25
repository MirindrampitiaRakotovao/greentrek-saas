import type { Prisma } from "@/generated/prisma/client";
import { calendarDate } from "@/lib/dates";
import { firstBookableDate, parseIsoDate, toIsoDate } from "@/lib/departs";
import { formatDateRange } from "@/lib/format";
import { notifyAgencyStaff, notifyClientUser } from "@/lib/services/notifications";
import { failure, type ServiceResult, success } from "@/lib/services/result";
import { STATUT_DEPART_SUR_MESURE_LABELS } from "@/lib/sur-mesure";
import type { TenantDb } from "@/lib/tenant";
import type { AnswerDepartInput, ProgramDepartInput } from "@/lib/validators/itineraires-perso";

/**
 * Départ d'un itinéraire sur mesure (étape 9, demande de l'étudiant). Parcours :
 * 1. le voyageur programme ses dates et le nombre de personnes, une fois l'itinéraire ACCEPTÉ
 *    (qu'il ait été proposé par l'agence ou demandé par lui) ; il peut modifier tant que
 *    l'agence n'a pas répondu ;
 * 2. l'agence confirme (tarif, guide, message facultatifs) ou refuse ;
 * 3. le voyageur peut annuler avant le début ; il peut reprogrammer après un refus ou une
 *    annulation (l'ancien départ reste en historique).
 * Un seul départ actif (DEMANDE ou CONFIRME) par itinéraire. Le paiement se règle avec
 * l'agence, hors plateforme. Client confiné à l'agence ; notifications dans la transaction.
 */

const ACTIFS = ["DEMANDE", "CONFIRME"] as const;

const departSelect = {
  id: true,
  itineraireId: true,
  dateDebut: true,
  dateFin: true,
  nombrePersonnes: true,
  remarques: true,
  statut: true,
  tarif: true,
  reponse: true,
  reponduAt: true,
  annuleAt: true,
  createdAt: true,
  guide: { select: { id: true, prenom: true, nom: true, telephone: true } },
} satisfies Prisma.DepartSurMesureSelect;

export type DepartSurMesureRow = Prisma.DepartSurMesureGetPayload<{
  select: typeof departSelect;
}> & {
  statutLabel: string;
};

const withLabel = <T extends { statut: keyof typeof STATUT_DEPART_SUR_MESURE_LABELS }>(row: T) => ({
  ...row,
  statutLabel: STATUT_DEPART_SUR_MESURE_LABELS[row.statut],
});

/** Départs d'un itinéraire, du plus récent au plus ancien (le premier actif est le courant). */
export async function listDepartsOfItineraire(
  db: TenantDb,
  itineraireId: string,
): Promise<DepartSurMesureRow[]> {
  const rows = await db.departSurMesure.findMany({
    where: { itineraireId },
    orderBy: { createdAt: "desc" },
    select: departSelect,
  });
  return rows.map(withLabel);
}

/** Le voyageur programme (ou modifie, tant que l'agence n'a pas répondu) le départ. */
export async function programDepart(
  db: TenantDb,
  input: ProgramDepartInput & { agenceId: string; clientId: string },
  now: Date = new Date(),
): Promise<ServiceResult<{ id: string; modifie: boolean }>> {
  const it = await db.itinerairePersonnalise.findFirst({
    where: { id: input.itineraireId, clientId: input.clientId },
    select: { statut: true, titre: true, client: { select: { prenom: true, nom: true } } },
  });
  if (!it) return failure("Itinéraire introuvable.");
  if (it.statut !== "ACCEPTE") {
    return failure("Le départ se programme une fois l'itinéraire accepté.");
  }
  const dateDebut = parseIsoDate(input.dateDebut);
  const dateFin = parseIsoDate(input.dateFin);
  const premier = firstBookableDate(calendarDate(now));
  if (dateDebut.getTime() < premier.getTime()) {
    return failure(
      `Le départ se programme au plus tôt pour le ${toIsoDate(premier).split("-").reverse().join("/")}.`,
      "dateDebut",
    );
  }
  if (dateFin.getTime() < dateDebut.getTime()) {
    return failure("La date de fin doit être le jour du début ou après.", "dateFin");
  }

  return db.$tenantTransaction(async (tx) => {
    const actif = await tx.departSurMesure.findFirst({
      where: { itineraireId: input.itineraireId, statut: { in: [...ACTIFS] } },
      select: { id: true, statut: true },
    });
    if (actif?.statut === "CONFIRME") {
      return failure(
        "Ce départ est déjà confirmé par l'agence : écrivez-lui pour le modifier, ou annulez-le.",
      );
    }
    const data = {
      dateDebut,
      dateFin,
      nombrePersonnes: input.nombrePersonnes,
      remarques: input.remarques,
    };
    let id: string;
    if (actif) {
      // Modification d'une demande encore sans réponse (ligne verrouillée par l'écriture).
      const { count } = await tx.departSurMesure.updateMany({
        where: { id: actif.id, statut: "DEMANDE" },
        data,
      });
      if (count !== 1) return failure("L'agence vient de répondre : rechargez la page.");
      id = actif.id;
    } else {
      const created = await tx.departSurMesure.create({
        data: { ...data, agenceId: input.agenceId, itineraireId: input.itineraireId },
        select: { id: true },
      });
      id = created.id;
    }
    await notifyAgencyStaff(tx, {
      type: "ITINERAIRE",
      titre: `${actif ? "Départ modifié" : "Départ à programmer"} par ${it.client.prenom} ${it.client.nom}`,
      message: `${it.titre} · ${formatDateRange(dateDebut, dateFin)} · ${input.nombrePersonnes} pers.`,
      lienUrl: `/dashboard/itineraires-sur-mesure/${input.itineraireId}`,
    });
    return success({ id, modifie: Boolean(actif) });
  });
}

/** Le voyageur annule son départ (demandé ou confirmé), avant le jour du début. */
export async function cancelDepartSurMesure(
  db: TenantDb,
  input: { id: string; clientId: string },
  now: Date = new Date(),
): Promise<ServiceResult> {
  const depart = await db.departSurMesure.findFirst({
    where: { id: input.id, itineraire: { clientId: input.clientId } },
    select: {
      statut: true,
      dateDebut: true,
      itineraireId: true,
      itineraire: { select: { titre: true, client: { select: { prenom: true, nom: true } } } },
    },
  });
  if (!depart) return failure("Départ introuvable.");
  if (depart.statut !== "DEMANDE" && depart.statut !== "CONFIRME") {
    return failure("Ce départ n'est plus actif.");
  }
  if (depart.dateDebut.getTime() <= calendarDate(now).getTime()) {
    return failure("Le départ a commencé : il ne peut plus être annulé ici. Écrivez à l'agence.");
  }
  return db.$tenantTransaction(async (tx) => {
    const { count } = await tx.departSurMesure.updateMany({
      where: { id: input.id, statut: { in: [...ACTIFS] } },
      data: { statut: "ANNULE", annuleAt: now },
    });
    if (count !== 1) return failure("Ce départ n'est plus actif.");
    await notifyAgencyStaff(tx, {
      type: "ITINERAIRE",
      titre: `Départ annulé par ${depart.itineraire.client.prenom} ${depart.itineraire.client.nom}`,
      message: depart.itineraire.titre,
      lienUrl: `/dashboard/itineraires-sur-mesure/${depart.itineraireId}`,
    });
    return success(undefined);
  });
}

/** L'agence confirme (tarif, guide, message) ou refuse une demande de départ. */
export async function answerDepartSurMesure(
  db: TenantDb,
  input: AnswerDepartInput & { agenceSlug: string },
  now: Date = new Date(),
): Promise<ServiceResult> {
  const depart = await db.departSurMesure.findFirst({
    where: { id: input.id },
    select: {
      statut: true,
      dateDebut: true,
      dateFin: true,
      itineraireId: true,
      itineraire: { select: { titre: true, clientId: true } },
    },
  });
  if (!depart) return failure("Départ introuvable.");
  if (depart.statut !== "DEMANDE") return failure("Ce départ a déjà reçu une réponse.");
  if (input.decision === "CONFIRME" && depart.dateDebut.getTime() < calendarDate(now).getTime()) {
    return failure("La date de début est passée : demandez au voyageur de reprogrammer.");
  }
  if (input.guideId) {
    // Guide actif de l'agence (le helper tenant vérifie aussi l'appartenance à l'écriture).
    const guide = await db.guide.findFirst({
      where: { id: input.guideId, actif: true },
      select: { id: true },
    });
    if (!guide) return failure("Guide introuvable ou inactif.", "guideId");
  }
  const confirme = input.decision === "CONFIRME";
  return db.$tenantTransaction(async (tx) => {
    const { count } = await tx.departSurMesure.updateMany({
      where: { id: input.id, statut: "DEMANDE" },
      data: {
        statut: input.decision,
        reponse: input.reponse,
        reponduAt: now,
        ...(confirme ? { tarif: input.tarif, guideId: input.guideId } : {}),
      },
    });
    if (count !== 1) return failure("Ce départ a déjà reçu une réponse.");
    await notifyClientUser(tx, depart.itineraire.clientId, {
      type: "ITINERAIRE",
      titre: confirme ? "Votre départ est confirmé" : "Votre agence a répondu à votre départ",
      message: `${depart.itineraire.titre} · ${formatDateRange(depart.dateDebut, depart.dateFin)}`,
      lienUrl: `/a/${input.agenceSlug}/mon-compte/itineraires/${depart.itineraireId}`,
    });
    return success(undefined);
  });
}

/** Départs sur mesure à venir de l'agence (demandés ou confirmés), du plus proche au plus loin. */
export async function listUpcomingDepartsSurMesure(db: TenantDb, now: Date = new Date()) {
  const rows = await db.departSurMesure.findMany({
    where: { statut: { in: [...ACTIFS] }, dateFin: { gte: calendarDate(now) } },
    orderBy: { dateDebut: "asc" },
    select: {
      ...departSelect,
      itineraire: { select: { titre: true, client: { select: { prenom: true, nom: true } } } },
    },
    take: 20,
  });
  return rows.map(withLabel);
}
