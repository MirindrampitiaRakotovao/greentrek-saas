import type { ClientReservation } from "@/lib/services/reservations";
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
