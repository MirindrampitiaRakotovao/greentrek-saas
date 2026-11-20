import { creditFor } from "@/lib/photo-credits";
import type { PublicationCard, PublicationDetail } from "@/lib/services/communaute";

/** Crédit d'une photo libre livrée avec le projet (attribution des licences CC), sinon null. */
function credit(src: string) {
  const c = creditFor(src);
  return c ? `${c.auteur} · ${c.licence}` : null;
}

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
    credits: p.photos.map(credit),
    listeCommentaires: p.listeCommentaires.map((c) => ({
      id: c.id,
      contenu: c.contenu,
      at: c.createdAt.toISOString(),
      auteur: c.auteur,
      deMoi: c.deMoi,
    })),
  };
}
