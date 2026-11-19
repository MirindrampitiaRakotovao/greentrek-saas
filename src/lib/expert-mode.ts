/**
 * « Mode expert » du back-office (étape « termes techniques », après E12). Par défaut,
 * l'interface parle simplement (« meilleur itinéraire », « le plus court ») ; le mode expert
 * affiche les algorithmes (Dijkstra, A*), leur comparaison, les mesures (nœuds explorés,
 * temps de calcul) et la page « Performances », pour la soutenance et le mémoire.
 *
 * Préférence d'affichage seulement (aucun droit en dépend) : cookie lu par le serveur (menu,
 * historique) et par la page.
 */
export const EXPERT_COOKIE = "gt-expert";

export function parseExpertCookie(value: string | undefined): boolean {
  return value === "1";
}
