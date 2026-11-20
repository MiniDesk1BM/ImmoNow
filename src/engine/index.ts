import type { Commune, CreditOptions, Evaluation, Property, SearchCriteria, UserProfile } from "../types";
import { aidRules } from "../config";
import communesData from "../data/communes.mel.json";
import biensData from "../data/biens.demo.json";
import { estimateTravaux, evaluate } from "./evaluate";
import { defaultCreditOptions } from "./finance";
import { matchesCriteria, sortEvaluations } from "./search";
import { parseCommunes, parseProperties } from "../schemas";

export const communes: Commune[] = parseCommunes(communesData);
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
    results.push(evaluate(bien, commune, profile, aidRules, years, credit));
  }
  return sortEvaluations(results);
}
