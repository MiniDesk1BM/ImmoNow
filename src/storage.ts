import type { SavedState } from "./types";
import { parseSavedState } from "./schemas";

/** Clé versionnée : un changement de format incompatible se traduit par un nouveau suffixe. */
export const STORAGE_KEY = "immonow.v1";

/** Sous-ensemble de `Storage` utilisé ici (permet de tester sans navigateur). */
export type KeyValueStore = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/** Stockage du navigateur, ou `null` s'il est indisponible (navigation privée, politique du navigateur). */
export function browserStore(): KeyValueStore | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

/**
 * Relit l'état sauvegardé. Tout problème (absent, JSON invalide, schéma non respecté, stockage bloqué,
 * références obsolètes) renvoie `null` : l'application repart des valeurs par défaut, sans erreur affichée.
 */
export function loadState(store: KeyValueStore | null, communeIds: string[], bienIds: string[]): SavedState | null {
  if (!store) return null;
  try {
    const raw = store.getItem(STORAGE_KEY);
    if (raw === null) return null;
    return parseSavedState(JSON.parse(raw), communeIds, bienIds);
  } catch {
    return null;
  }
}

/** Enregistre l'état ; renvoie `false` si le stockage est plein ou refusé (l'application continue sans sauvegarde). */
export function saveState(store: KeyValueStore | null, state: SavedState): boolean {
  if (!store) return false;
  try {
    store.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function clearState(store: KeyValueStore | null): void {
  try {
    store?.removeItem(STORAGE_KEY);
  } catch {
    /* stockage inaccessible : rien à effacer */
  }
}
