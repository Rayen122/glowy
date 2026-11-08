/**
 * Outils communs aux IA par API : cache mémoire à durée de vie (une page affichée ne rappelle pas le modèle à chaque fois,
 * le quota gratuit est préservé) et délai maximal (une page n'attend jamais un modèle lent : repli sur l'algorithme local).
 */

/** Cache à durée de vie ; les appels simultanés pour la même clé partagent la même requête, un échec n'est pas gardé */
export function ttlCache<T>(ttlMs: number, max = 500) {
  const store = new Map<string, { at: number; value: Promise<T> }>();
  return (key: string, load: () => Promise<T>): Promise<T> => {
    const hit = store.get(key);
    if (hit && Date.now() - hit.at < ttlMs) return hit.value;
    const value = load();
    store.set(key, { at: Date.now(), value });
    if (store.size > max) store.delete(store.keys().next().value!);
    value.catch(() => store.delete(key));
    return value;
  };
}

/** Rejette au-delà de `ms` millisecondes (la requête continue et remplit le cache pour la prochaine fois) */
export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([promise, new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`délai de ${ms} ms dépassé`)), ms))]);
}
