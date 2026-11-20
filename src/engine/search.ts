import type { Commune, Evaluation, Property, SearchCriteria, TriKey } from "../types";

/** Distance à vol d'oiseau (haversine), en km. */
export function distanceKm(a: Commune, b: Commune): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

export function matchesCriteria(
  bien: Property,
  commune: Commune,
  centre: Commune,
  c: SearchCriteria,
  travauxEstimes: number,
): boolean {
  if (!c.types.includes(bien.type)) return false;
  if (!c.categories.includes(bien.categorie)) return false;
  if (bien.surface < c.surfaceMin || bien.chambres < c.chambresMin) return false;
  if (!c.accepteTravaux && travauxEstimes > 0 && (bien.dpe === "F" || bien.dpe === "G")) return false;
  return distanceKm(centre, commune) <= c.rayonKm;
}

const ORDRE = { vert: 0, orange: 1, rouge: 2 } as const;

/** Tri : statut, puis score décroissant, puis prix croissant, puis identifiant (ordre déterministe). */
export function sortEvaluations(evals: Evaluation[]): Evaluation[] {
  return [...evals].sort(
    (a, b) =>
      ORDRE[a.statut] - ORDRE[b.statut] ||
      b.scorePct - a.scorePct ||
      a.bien.prix - b.bien.prix ||
      a.bien.id.localeCompare(b.bien.id),
  );
}

export const TRI_LABELS: Record<TriKey, string> = {
  pertinence: "Pertinence (faisabilité, puis score)",
  score: "Score décroissant",
  prixAsc: "Prix croissant",
  prixDesc: "Prix décroissant",
  prixM2: "Prix au m² croissant",
  mensualite: "Mensualité croissante",
  resteAVivre: "Reste à vivre décroissant",
  ecartMarche: "Écart au marché (le moins cher d'abord)",
};

/** Valeur numérique triée par ordre croissant ; `null` = absent, toujours classé en dernier. */
const CLES: Record<Exclude<TriKey, "pertinence">, (e: Evaluation) => number | null> = {
  score: (e) => -e.scorePct,
  prixAsc: (e) => e.bien.prix,
  prixDesc: (e) => -e.bien.prix,
  prixM2: (e) => e.bien.prix / e.bien.surface,
  mensualite: (e) => e.mensualitePhase1,
  resteAVivre: (e) => -e.resteAVivre,
  ecartMarche: (e) => e.marche?.ecartPct ?? null,
};

/** Tri choisi par l'utilisateur ; égalités départagées par prix puis identifiant (ordre stable et déterministe). */
export function sortBy(evals: Evaluation[], key: TriKey): Evaluation[] {
  if (key === "pertinence") return sortEvaluations(evals);
  const val = CLES[key];
  return [...evals].sort((a, b) => {
    const va = val(a);
    const vb = val(b);
    if (va === null && vb !== null) return 1;
    if (vb === null && va !== null) return -1;
    return (va ?? 0) - (vb ?? 0) || a.bien.prix - b.bien.prix || a.bien.id.localeCompare(b.bien.id);
  });
}
