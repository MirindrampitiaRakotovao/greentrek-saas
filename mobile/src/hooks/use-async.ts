import { useCallback, useEffect, useEffectEvent, useState } from "react";

type Result<T> = { key: string; data: T | null; error: string | null };

/**
 * Chargement d'une donnée de l'API pour une clé donnée (ex. les filtres de recherche).
 * - Nouvelle clé ou `reload()` : nouvelle requête ; les données précédentes restent affichées
 *   pendant le chargement (pas de clignotement).
 * - Une réponse arrivée après un changement de clé est ignorée (requête périmée).
 */
export function useAsync<T>(load: () => Promise<T>, key: string) {
  const [result, setResult] = useState<Result<T> | null>(null);
  const [round, setRound] = useState(0);
  const requestKey = `${key}#${round}`;
  const run = useEffectEvent(load);
  // Fonction stable : utilisable dans `useFocusEffect` (rechargement au retour sur un écran).
  const reload = useCallback(() => setRound((r) => r + 1), []);

  useEffect(() => {
    let current = true;
    run().then(
      (data) => current && setResult({ key: requestKey, data, error: null }),
      (error: unknown) =>
        current &&
        setResult({
          key: requestKey,
          data: null,
          error: error instanceof Error ? error.message : "Erreur inattendue.",
        }),
    );
    return () => {
      current = false;
    };
  }, [requestKey]);

  return {
    data: result?.data ?? null,
    error: result?.key === requestKey ? result.error : null,
    loading: result?.key !== requestKey,
    reload,
  };
}
