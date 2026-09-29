import { montantPaye } from "@/lib/services/reservations";
import type { TenantDb } from "@/lib/tenant";

/**
 * Données d'une facture (ajout de l'étape E10, hors cahier des charges). Document SIMULÉ :
 * pas de numérotation fiscale continue, pas de TVA, mention « sans valeur fiscale ».
 * Lu par le client confiné : la facture d'une autre agence est introuvable.
 */
export type EtatFacture = "ACQUITTEE" | "PROFORMA" | "ANNULEE";

export const ETAT_FACTURE_LABELS: Record<EtatFacture, string> = {
  ACQUITTEE: "Facture acquittée",
  PROFORMA: "Facture pro forma",
  ANNULEE: "Facture annulée",
};

export async function getInvoice(db: TenantDb, agenceId: string, reservationId: string) {
  const [agence, reservation] = await Promise.all([
    db.agence.findUnique({
      where: { id: agenceId },
      select: {
        nom: true,
        slug: true,
        adresse: true,
        ville: true,
        pays: true,
        email: true,
        telephone: true,
        devise: true,
      },
    }),
    db.reservation.findUnique({
      where: { id: reservationId },
      select: {
        id: true,
        reference: true,
        statut: true,
        nombrePersonnes: true,
        montantTotal: true,
        createdAt: true,
        confirmeeAt: true,
        annuleeAt: true,
        client: { select: { prenom: true, nom: true, email: true, telephone: true } },
        session: {
          select: {
            dateDebut: true,
            dateFin: true,
            circuit: { select: { titre: true, dureeJours: true } },
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
      },
    }),
  ]);
  if (!agence || !reservation) return null;
  const paye = montantPaye(reservation.paiements);
  const rembourse = reservation.paiements
    .filter((p) => p.statut === "REMBOURSE")
    .reduce((total, p) => total + p.montant, 0);
  const etat: EtatFacture =
    reservation.statut === "ANNULEE"
      ? "ANNULEE"
      : paye >= reservation.montantTotal
        ? "ACQUITTEE"
        : "PROFORMA";
  return {
    agence,
    reservation,
    paye,
    rembourse,
    reste: Math.max(0, reservation.montantTotal - paye),
    // Le montant total est figé (RG 14) : prix unitaire retrouvé à partir de lui.
    prixUnitaire: Math.round(reservation.montantTotal / reservation.nombrePersonnes),
    etat,
  };
}

export type Invoice = NonNullable<Awaited<ReturnType<typeof getInvoice>>>;
