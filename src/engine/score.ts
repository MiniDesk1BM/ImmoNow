import type { AidRules, ScoreDetail } from "../types";

const clamp01 = (x: number): number => (Number.isFinite(x) ? Math.min(1, Math.max(0, x)) : 0);

export interface ScoreInput {
  /** Ressources mobilisées (apport, aides, prêts) */
  ressources: number;
  coutTotal: number;
  apport: number;
  /** Taux d'endettement à la mensualité maximale (pic), crédits en cours inclus */
  tauxEndettement: number;
  resteAVivre: number;
  resteAVivreMin: number;
}

/**
 * Score de faisabilité 0-100, moyenne pondérée de 4 notes dans [0, 1] :
 * - financement : part du coût total effectivement financée ;
 * - endettement : marge sous le taux max (max si ≤ (1 − marge cible) × max, nulle au taux max) ;
 * - resteAVivre : multiple du seuil de confort (max à resteAVivreCibleRatio × seuil) ;
 * - apport : part d'apport personnel dans le coût total (max à apportCiblePct).
 * Deux biens entièrement financés ont donc des scores différents selon leur marge réelle.
 */
export function computeScore(i: ScoreInput, rules: AidRules): { pct: number; detail: ScoreDetail } {
  const { poids, margeEndettementCible, resteAVivreCibleRatio, apportCiblePct } = rules.score;
  const max = rules.credit.tauxEndettementMax;
  const cible = max * (1 - margeEndettementCible);
  const detail: ScoreDetail = {
    financement: i.coutTotal > 0 ? clamp01(i.ressources / i.coutTotal) : 0,
    endettement: clamp01((max - i.tauxEndettement) / (max - cible)),
    resteAVivre:
      i.resteAVivreMin > 0 ? clamp01(i.resteAVivre / (i.resteAVivreMin * resteAVivreCibleRatio)) : i.resteAVivre > 0 ? 1 : 0,
    apport: i.coutTotal > 0 ? clamp01(i.apport / i.coutTotal / apportCiblePct) : 0,
  };
  const pct = Math.round(
    100 *
      (poids.financement * detail.financement +
        poids.endettement * detail.endettement +
        poids.resteAVivre * detail.resteAVivre +
        poids.apport * detail.apport),
  );
  return { pct: Math.min(100, Math.max(0, pct)), detail };
}
