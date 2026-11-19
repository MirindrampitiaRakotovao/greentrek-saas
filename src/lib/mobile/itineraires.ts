import type { Itineraire } from "@/lib/services/itineraires-perso";

/** Itinéraire sur mesure en JSON pour l'application (dates ISO). */
export function toMobileItineraire(it: Itineraire) {
  return {
    id: it.id,
    titre: it.titre,
    message: it.message,
    origine: it.origine,
    statut: it.statut,
    statutLabel: it.statutLabel,
    reponse: it.reponse,
    reponduAt: it.reponduAt?.toISOString() ?? null,
    createdAt: it.createdAt.toISOString(),
    auteur: it.auteur,
    critere: it.critere,
    distanceKm: Math.round(it.distanceKm * 100) / 100,
    dureeMinutes: it.dureeMinutes,
    difficulteMoyenne: it.difficulteMoyenne,
    depart: it.depart,
    arrivee: it.arrivee,
    etapes: it.etapes,
    peutRepondre: it.origine === "AGENCE" && it.statut === "EN_ATTENTE",
  };
}
