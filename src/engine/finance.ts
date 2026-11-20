import type { AidRules, CreditOptions, Garantie, LignePret, UserProfile } from "../types";

/** Mensualité hors assurance d'un prêt amorti (taux annuel nominal). */
export function pmt(principal: number, annualRate: number, years: number): number {
  const n = Math.round(years * 12);
  if (principal <= 0 || n <= 0) return 0;
  const r = annualRate / 12;
  return r === 0 ? principal / n : (principal * r) / (1 - Math.pow(1 + r, -n));
}

export function defaultCreditOptions(rules: AidRules): CreditOptions {
  return { ajustementTaux: 0, garantie: rules.credit.garantie.defaut };
}

/** Taux de la grille (durée la plus proche par excès, sinon la plus longue) + ajustement, plancher 0. */
export function creditRate(years: number, rules: AidRules, ajustement = 0): number {
  const keys = Object.keys(rules.credit.tauxParDuree)
    .map(Number)
    .sort((a, b) => a - b);
  const key = keys.find((k) => k >= years) ?? keys[keys.length - 1];
  const base = rules.credit.tauxParDuree[String(key)] ?? 0;
  return Math.max(0, base + ajustement);
}

/** Mensualité par euro emprunté, assurance incluse. */
export function bankPaymentFactor(years: number, rules: AidRules, ajustement = 0): number {
  return pmt(1, creditRate(years, rules, ajustement), years) + rules.credit.assuranceAnnuelle / 12;
}

/** Mensualité maximale admissible (taux d'endettement max, crédits en cours déduits). */
export function maxMonthlyPayment(profile: UserProfile, rules: AidRules): number {
  const { revenusNetsMensuels, mensualitesCredits } = profile.finances;
  return Math.max(0, revenusNetsMensuels * rules.credit.tauxEndettementMax - mensualitesCredits);
}

export function borrowingCapacity(monthly: number, years: number, rules: AidRules, ajustement = 0): number {
  return Math.max(0, Math.floor(monthly / bankPaymentFactor(years, rules, ajustement)));
}

export interface FraisCredit {
  dossier: number;
  garantie: number;
  total: number;
}

/** Frais de dossier (borné) + garantie, calculés sur le montant du prêt bancaire. Nuls si pas de prêt. */
export function creditFees(loan: number, rules: AidRules, garantie: Garantie): FraisCredit {
  if (loan <= 0) return { dossier: 0, garantie: 0, total: 0 };
  const { fraisDossier, garantie: g } = rules.credit;
  const dossier = Math.round(Math.min(fraisDossier.max, Math.max(fraisDossier.min, loan * fraisDossier.pct)));
  const gar = Math.round(loan * g.pct[garantie]);
  return { dossier, garantie: gar, total: dossier + gar };
}

/**
 * Prêt bancaire nécessaire pour couvrir `besoin` ET ses propres frais (financés dans le prêt) :
 * L = besoin + frais(L). Point fixe (les frais croissent moins vite que L), puis ajustement d'entier.
 */
export function loanForNeed(besoin: number, rules: AidRules, garantie: Garantie): number {
  if (besoin <= 0) return 0;
  let loan = besoin;
  for (let i = 0; i < 50; i++) {
    const next = Math.ceil(besoin + creditFees(loan, rules, garantie).total);
    if (next === loan) break;
    loan = next;
  }
  for (let i = 0; i < 1000 && besoin + creditFees(loan, rules, garantie).total > loan; i++) loan += 1;
  return loan;
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
  /** Frais de crédit (dossier + garantie) sur la capacité d'emprunt */
  fraisCredit: FraisCredit;
  /** Apport + capacité + Action Logement − frais de crédit : hors PTZ et aides propres à chaque bien */
  budgetGlobal: number;
  /** Prix net vendeur maximal par catégorie (frais de notaire déduits, hors travaux) */
  netVendeurMax: Record<string, number>;
}

export function summarizeBudget(
  profile: UserProfile,
  rules: AidRules,
  years: number,
  opts: CreditOptions = defaultCreditOptions(rules),
): BudgetSummary {
  const mensualiteMax = maxMonthlyPayment(profile, rules);
  const capaciteEmprunt = borrowingCapacity(mensualiteMax, years, rules, opts.ajustementTaux);
  const fraisCredit = creditFees(capaciteEmprunt, rules, opts.garantie);
  const al = profile.salariePrive ? rules.actionLogement.montantMax : 0;
  const budgetGlobal = Math.max(0, profile.finances.apport + capaciteEmprunt + al - fraisCredit.total);
  const netVendeurMax: Record<string, number> = {};
  for (const [cat, taux] of Object.entries(rules.fraisNotaire)) {
    netVendeurMax[cat] = Math.floor(budgetGlobal / (1 + taux));
  }
  return { mensualiteMax, capaciteEmprunt, fraisCredit, budgetGlobal, netVendeurMax };
}
