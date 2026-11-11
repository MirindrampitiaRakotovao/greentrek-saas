import type { ClientReservation } from "@/lib/services/reservations";
import { STATUT_AVIS_LABELS } from "@/lib/validators/avis";
import {
  METHODE_PAIEMENT_LABELS,
  STATUT_PAIEMENT_LABELS,
  STATUT_RESERVATION_LABELS,
} from "@/lib/validators/reservations";

/**
 * Réservation d'un voyageur en JSON pour l'application (après E12) : mêmes données et mêmes
 * règles (« peut payer », « peut annuler ») que l'espace voyageur du site, calculées par le
 * service ; dates calendaires « AAAA-MM-JJ », libellés français prêts à afficher.
 */
const isoDay = (date: Date) => date.toISOString().slice(0, 10);

export function toMobileReservation(
  r: ClientReservation,
  agence: { slug: string; nom: string; devise: string },
  /** Lien signé de la facture (chemin du site), fourni par la fiche d'une réservation. */
  facture: string | null = null,
) {
  return {
    id: r.id,
    reference: r.reference,
    statut: r.statut,
    statutLabel: STATUT_RESERVATION_LABELS[r.statut],
    nombrePersonnes: r.nombrePersonnes,
    montantTotal: r.montantTotal,
    paye: r.paye,
    reste: r.reste,
    peutPayer: r.peutPayer,
    peutAnnuler: r.peutAnnuler,
    peutDonnerAvis: r.peutDonnerAvis,
    avis: r.avis
      ? {
          note: r.avis.note,
          commentaire: r.avis.commentaire,
          statut: r.avis.statut,
          statutLabel: STATUT_AVIS_LABELS[r.avis.statut],
        }
      : null,
    facture,
    remarques: r.remarques,
    createdAt: r.createdAt.toISOString(),
    agence,
    circuit: {
      titre: r.session.circuit.titre,
      slug: r.session.circuit.slug,
      image: r.session.circuit.imagePrincipaleUrl,
    },
    depart: { dateDebut: isoDay(r.session.dateDebut), dateFin: isoDay(r.session.dateFin) },
    participants: r.participants.map((p) => ({
      prenom: p.prenom,
      nom: p.nom,
      age: p.age,
      nationalite: p.nationalite,
    })),
    paiements: r.paiements.map((p) => ({
      id: p.id,
      montant: p.montant,
      methode: p.methode,
      methodeLabel: METHODE_PAIEMENT_LABELS[p.methode],
      statut: p.statut,
      statutLabel: STATUT_PAIEMENT_LABELS[p.statut],
      reference: p.referenceExterne,
      payeLe: p.payeLe?.toISOString() ?? null,
    })),
  };
}

export type MobileReservation = ReturnType<typeof toMobileReservation>;
