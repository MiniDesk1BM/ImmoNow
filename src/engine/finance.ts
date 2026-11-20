import type { AidRules, LignePret, UserProfile } from "../types";

/** Mensualité hors assurance d'un prêt amorti (taux annuel nominal). */
export function pmt(principal: number, annualRate: number, years: number): number {
  const n = Math.round(years * 12);
  if (principal <= 0 || n <= 0) return 0;
  const r = annualRate / 12;
  return r === 0 ? principal / n : (principal * r) / (1 - Math.pow(1 + r, -n));
}

/** Taux de la grille dont la durée est la plus proche par excès (sinon la plus longue). */
export function creditRate(years: number, rules: AidRules): number {
  const keys = Object.keys(rules.credit.tauxParDuree)
    .map(Number)
    .sort((a, b) => a - b);
  const key = keys.find((k) => k >= years) ?? keys[keys.length - 1];
  return rules.credit.tauxParDuree[String(key)] ?? 0;
}

/** Mensualité par euro emprunté, assurance incluse. */
export function bankPaymentFactor(years: number, rules: AidRules): number {
  return pmt(1, creditRate(years, rules), years) + rules.credit.assuranceAnnuelle / 12;
}

/** Mensualité maximale admissible (taux d'endettement max, crédits en cours déduits). */
export function maxMonthlyPayment(profile: UserProfile, rules: AidRules): number {
  const { revenusNetsMensuels, mensualitesCredits } = profile.finances;
  return Math.max(0, revenusNetsMensuels * rules.credit.tauxEndettementMax - mensualitesCredits);
}

export function borrowingCapacity(monthly: number, years: number, rules: AidRules): number {
  return Math.max(0, Math.floor(monthly / bankPaymentFactor(years, rules)));
}

export function monthlyAt(prets: LignePret[], t: number): number {
  return prets.reduce((s, p) => (p.debutAns <= t && t < p.finAns ? s + p.mensualite : s), 0);
}

/** Mensualité maximale cumulée des prêts sur [0, horizon[. */
export function peakMonthly(prets: LignePret[], horizonAns: number): number {
  const points = [0, ...prets.map((p) => p.debutAns)].filter((t) => t < horizonAns);
  return points.reduce((m, t) => Math.max(m, monthlyAt(prets, t)), 0);
}

export interface BudgetSummary {
  mensualiteMax: number;
  capaciteEmprunt: number;
  /** Capacité + apport (+ Action Logement) : hors PTZ et aides propres à chaque bien */
  budgetGlobal: number;
  /** Prix net vendeur maximal par catégorie (frais de notaire déduits, hors travaux) */
  netVendeurMax: Record<string, number>;
}

export function summarizeBudget(
  profile: UserProfile,
  rules: AidRules,
  years: number,
): BudgetSummary {
  const mensualiteMax = maxMonthlyPayment(profile, rules);
  const capaciteEmprunt = borrowingCapacity(mensualiteMax, years, rules);
  const al = profile.salariePrive ? rules.actionLogement.montantMax : 0;
  const budgetGlobal = profile.finances.apport + capaciteEmprunt + al;
  const netVendeurMax: Record<string, number> = {};
  for (const [cat, taux] of Object.entries(rules.fraisNotaire)) {
    netVendeurMax[cat] = Math.floor(budgetGlobal / (1 + taux));
  }
  return { mensualiteMax, capaciteEmprunt, budgetGlobal, netVendeurMax };
}
