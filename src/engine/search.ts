import type { Commune, Evaluation, Property, SearchCriteria } from "../types";

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

/** Tri : statut, puis score décroissant, puis prix croissant. */
export function sortEvaluations(evals: Evaluation[]): Evaluation[] {
  return [...evals].sort(
    (a, b) => ORDRE[a.statut] - ORDRE[b.statut] || b.scorePct - a.scorePct || a.bien.prix - b.bien.prix,
  );
}
