import type {
  Commune,
  CreditOptions,
  Evaluation,
  MarketData,
  Property,
  SearchCriteria,
  UserProfile,
  ZonageData,
} from "../types";
import { aidRules } from "../config";
import communesData from "../data/communes.json";
import biensData from "../data/biens.demo.json";
import zonageData from "../data/zonage.abc.json";
import marcheData from "../data/marche.dvf.json";
import { estimateTravaux, evaluate } from "./evaluate";
import { defaultCreditOptions } from "./finance";
import { matchesCriteria, sortEvaluations } from "./search";
export { RAYON_MAX_KM, sortBy, TRI_LABELS } from "./search";
import { parseCommunes, parseMarket, parseProperties, parseZonage } from "../schemas";

/** Sources de données ouvertes (zonage ABC : ministère ; DVF : DGFiP/Etalab), validées au chargement. */
export const zonage: ZonageData = parseZonage(zonageData);
export const communes: Commune[] = parseCommunes(communesData, zonage);
export const marche: MarketData = parseMarket(marcheData, communes);
export const biens: Property[] = parseProperties(biensData, communes);

export const defaultProfile: UserProfile = {
  foyer: { adultes: 2, enfants: 1 },
  primoAccedant: true,
  salariePrive: true,
  finances: { revenusNetsMensuels: 4200, rfrN2: 46000, apport: 30000, mensualitesCredits: 0 },
};

export const defaultCriteria: SearchCriteria = {
  communeCentreId: "lille",
  rayonKm: 10,
  types: ["maison", "appartement"],
  surfaceMin: 50,
  chambresMin: 2,
  categories: ["neuf", "ancien", "brs", "hlm"],
  accepteTravaux: true,
};

export const defaultCredit: CreditOptions = defaultCreditOptions(aidRules);

/** Évalue des biens précis (favoris, comparaison), indépendamment des critères de recherche. */
export function evaluateByIds(
  ids: string[],
  profile: UserProfile,
  years: number,
  credit: CreditOptions = defaultCredit,
): Evaluation[] {
  const byId = new Map(communes.map((c) => [c.id, c]));
  const out: Evaluation[] = [];
  for (const id of ids) {
    const bien = biens.find((b) => b.id === id);
    const commune = bien && byId.get(bien.communeId);
    if (bien && commune) out.push(evaluate(bien, commune, profile, aidRules, years, credit, marche));
  }
  return out;
}

export function runSearch(
  profile: UserProfile,
  criteria: SearchCriteria,
  years: number,
  credit: CreditOptions = defaultCredit,
): Evaluation[] {
  const byId = new Map(communes.map((c) => [c.id, c]));
  const centre = byId.get(criteria.communeCentreId);
  if (!centre) return [];
  const results: Evaluation[] = [];
  for (const bien of biens) {
    const commune = byId.get(bien.communeId);
    if (!commune) continue;
    if (!matchesCriteria(bien, commune, centre, criteria, estimateTravaux(bien, aidRules))) continue;
    results.push(evaluate(bien, commune, profile, aidRules, years, credit, marche));
  }
  return sortEvaluations(results);
}
