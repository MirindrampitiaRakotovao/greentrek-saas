import { afterCommit } from "@/lib/after-commit";

import type { RealtimeEvent } from "./events";

/**
 * Bus d'événements temps réel, en mémoire (messagerie et notifications, après E12).
 *
 * Chaque onglet connecté à `/api/temps-reel` s'abonne pour SON utilisateur ; un service qui
 * crée une notification ou un message publie l'événement vers les utilisateurs concernés.
 * Limite assumée (démonstration locale) : un seul processus serveur. Avec plusieurs
 * serveurs, il faudrait un relais partagé (ex. Redis Pub/Sub) à la place de cette Map.
 *
 * La Map est rangée sur `globalThis` : en développement, le rechargement à chaud peut
 * dupliquer les modules, et la route et les actions doivent partager le même bus.
 */

type Listener = (event: RealtimeEvent) => void;

const KEY = Symbol.for("greentrek.realtime.listeners");
type GlobalWithBus = typeof globalThis & { [KEY]?: Map<string, Set<Listener>> };

function listeners(): Map<string, Set<Listener>> {
  const g = globalThis as GlobalWithBus;
  g[KEY] ??= new Map();
  return g[KEY];
}

/** Abonne un onglet aux événements de l'utilisateur ; renvoie la fonction de désabonnement. */
export function subscribe(utilisateurId: string, listener: Listener): () => void {
  const map = listeners();
  const set = map.get(utilisateurId) ?? new Set<Listener>();
  set.add(listener);
  map.set(utilisateurId, set);
  return () => {
    set.delete(listener);
    if (set.size === 0) map.delete(utilisateurId);
  };
}

/** Nombre d'onglets connectés (tests et diagnostic). */
export function connectionCount(utilisateurId?: string): number {
  const map = listeners();
  if (utilisateurId) return map.get(utilisateurId)?.size ?? 0;
  let total = 0;
  for (const set of map.values()) total += set.size;
  return total;
}

/**
 * Publie un événement vers des utilisateurs, APRÈS la validation de la transaction en cours
 * (`afterCommit`). Un onglet en erreur n'empêche pas les autres de recevoir l'événement.
 */
export function publish(utilisateurIds: Iterable<string>, event: RealtimeEvent): void {
  const destinataires = [...new Set(utilisateurIds)];
  afterCommit(() => {
    const map = listeners();
    for (const id of destinataires) {
      for (const listener of map.get(id) ?? []) {
        try {
          listener(event);
        } catch {
          // Onglet fermé entre-temps : il sera désabonné par la route.
        }
      }
    }
  });
}
