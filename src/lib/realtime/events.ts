/**
 * Événements temps réel envoyés au navigateur (Server-Sent Events). Données publiques pour
 * leur destinataire uniquement : aucune donnée sensible, seulement de quoi afficher une
 * notification ; la page relit ensuite la base (droits vérifiés comme d'habitude).
 */
export type RealtimeEvent =
  | { type: "notification"; titre: string; message: string; lienUrl: string | null }
  | {
      type: "message";
      conversationId: string;
      sujet: string;
      auteur: string;
      extrait: string;
    };

/** Extrait d'un message affiché dans la notification (le fil complet reste sur la page). */
export function excerpt(text: string, max = 120): string {
  const single = text.replace(/\s+/g, " ").trim();
  return single.length <= max ? single : `${single.slice(0, max - 1)}…`;
}
