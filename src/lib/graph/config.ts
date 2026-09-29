/**
 * Paramètres du graphe (cahier des charges §6.1), décisions validées à l'étape E5.
 * Ils ne servent qu'à PROPOSER des valeurs : l'agence peut toujours corriger un tronçon avec
 * une mesure de terrain (et `distanceEstimee` repasse alors à faux).
 */

/**
 * Coefficient de sinuosité : longueur d'un sentier / distance à vol d'oiseau. Un sentier
 * mesure en général 1,2 à 1,4 fois la ligne droite ; 1,3 est une valeur médiane, à ajuster
 * avec les relevés GPS de l'agence.
 */
export const COEFFICIENT_SINUOSITE = 1.3;

/**
 * Règle de Naismith adaptée : 4 km/h sur le plat (5 km/h dans la règle d'origine ; valeur
 * réduite pour un groupe sur sentiers tropicaux), plus 1 heure par 600 m de dénivelé positif.
 */
export const VITESSE_MARCHE_KMH = 4;
export const MONTEE_METRES_PAR_HEURE = 600;
