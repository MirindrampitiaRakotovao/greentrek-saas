import { AsyncLocalStorage } from "node:async_hooks";

/**
 * « Après le commit » : actions différées jusqu'à la validation d'une transaction (sans
 * dépendance à la base, donc testable unitairement). Utilisé par `$tenantTransaction`.
 */

const commitHooks = new AsyncLocalStorage<(() => void)[]>();

/**
 * Exécute `callback` après la validation (commit) de la transaction en cours, ou tout de
 * suite hors transaction. Abandonné si la transaction échoue. Sert à diffuser un événement
 * temps réel seulement une fois la donnée réellement enregistrée : sinon, le navigateur
 * pourrait relire la base avant le commit et afficher un état périmé.
 */
export function afterCommit(callback: () => void): void {
  const queue = commitHooks.getStore();
  if (queue) queue.push(callback);
  else callback();
}

/** Exécute `transaction` ; en cas de succès seulement, lance ensuite les actions différées. */
export async function runWithCommitHooks<R>(transaction: () => Promise<R>): Promise<R> {
  const queue: (() => void)[] = [];
  const result = await commitHooks.run(queue, transaction);
  // Après le commit : une erreur ici ne doit pas faire croire à un échec d'écriture.
  for (const callback of queue) {
    try {
      callback();
    } catch (error: unknown) {
      console.error("afterCommit :", error);
    }
  }
  return result;
}
