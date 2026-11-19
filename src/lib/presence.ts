/**
 * Présence « en ligne » (étape 5c) : fonctions pures, testées.
 * - en ligne : activité depuis moins de 2 minutes (le site en temps réel et l'application qui
 *   interroge toutes les 20 secondes rafraîchissent la dernière activité) ;
 * - sinon « vu il y a … » ; rien si l'utilisateur masque sa présence ou n'a jamais été actif.
 */
export const EN_LIGNE_MS = 2 * 60_000;
/** Écriture de la dernière activité au plus une fois par minute (pas une écriture par requête). */
export const PRESENCE_ECRITURE_MS = 60_000;

export type Presence = { enLigne: boolean; vu: string | null };

export function presenceOf(
  derniereActiviteAt: Date | null,
  visible: boolean,
  now: Date = new Date(),
): Presence {
  if (!visible || !derniereActiviteAt) return { enLigne: false, vu: null };
  const ecart = now.getTime() - derniereActiviteAt.getTime();
  if (ecart < EN_LIGNE_MS) return { enLigne: true, vu: null };
  const min = Math.floor(ecart / 60_000);
  if (min < 60) return { enLigne: false, vu: `vu il y a ${min} min` };
  const h = Math.floor(min / 60);
  if (h < 24) return { enLigne: false, vu: `vu il y a ${h} h` };
  const j = Math.floor(h / 24);
  return { enLigne: false, vu: j < 30 ? `vu il y a ${j} j` : null };
}

/** Présence d'un groupe (l'équipe de l'agence) : en ligne si au moins un membre l'est. */
export function presenceOfGroup(
  membres: readonly { derniereActiviteAt: Date | null; presenceVisible: boolean }[],
  now: Date = new Date(),
): Presence {
  const all = membres.map((m) => presenceOf(m.derniereActiviteAt, m.presenceVisible, now));
  if (all.some((p) => p.enLigne)) return { enLigne: true, vu: null };
  const recents = membres
    .filter((m) => m.presenceVisible && m.derniereActiviteAt)
    .sort((a, b) => b.derniereActiviteAt!.getTime() - a.derniereActiviteAt!.getTime());
  return recents[0]
    ? presenceOf(recents[0].derniereActiviteAt, true, now)
    : { enLigne: false, vu: null };
}
