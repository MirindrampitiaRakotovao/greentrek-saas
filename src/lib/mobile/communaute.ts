import type { PublicationCard, PublicationDetail } from "@/lib/services/communaute";

/** Mise en forme JSON des publications de la communauté pour l'application (étape 5d). */
export function toMobilePublication(p: PublicationCard) {
  return {
    id: p.id,
    legende: p.legende,
    photos: p.photos,
    at: p.createdAt.toISOString(),
    auteur: p.auteur,
    agence: p.agence,
    circuit: p.circuit,
    jaimes: p.jaimes,
    jAime: p.jAime,
    commentaires: p.commentaires,
    deMoi: p.deMoi,
  };
}

export function toMobilePublicationDetail(p: PublicationDetail) {
  return {
    ...toMobilePublication(p),
    listeCommentaires: p.listeCommentaires.map((c) => ({
      id: c.id,
      contenu: c.contenu,
      at: c.createdAt.toISOString(),
      auteur: c.auteur,
      deMoi: c.deMoi,
    })),
  };
}
