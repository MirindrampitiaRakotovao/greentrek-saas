/**
 * Adresse de retour après connexion ou inscription d'un client (tunnel de réservation) :
 * le visiteur qui clique « Réserver » sans être connecté revient ensuite au départ choisi.
 *
 * Sécurité (redirection ouverte) : le paramètre `retour` vient de l'URL, donc de n'importe
 * qui. Un lien piégé `…/connexion?retour=https://site-malveillant.test` renverrait la victime,
 * juste après sa connexion, vers un faux site. On n'accepte donc qu'un chemin INTERNE au site
 * de l'agence (`/a/<slug>/…`), sans protocole, sans `//`, sans `..` ni caractère inattendu.
 */
const SAFE_PATH = /^\/a\/[a-z0-9-]+(?:\/[A-Za-z0-9_-]+)*\/?$/;

export function safeReturnPath(
  retour: string | null | undefined,
  agenceSlug: string,
): string | null {
  if (!retour) return null;
  if (!SAFE_PATH.test(retour)) return null;
  const prefix = `/a/${agenceSlug}/`;
  return retour.startsWith(prefix) || retour === `/a/${agenceSlug}` ? retour : null;
}
