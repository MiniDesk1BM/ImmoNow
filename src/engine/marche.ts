import type { MarcheComparaison, MarcheVerdict, MarketData, MarketEntry, Property, Stats, Commune, AidRules } from "../types";

/**
 * Compare le prix au m² d'un bien à la médiane des ventes DVF comparables
 * (même type de bien, même régime ancien/neuf, même commune ; repli sur l'agglomération
 * si la commune a moins de `marche.minTransactions` ventes).
 *
 * Non comparable (null) : BRS (le prix exclut le foncier, redevance en sus), vente HLM (décote
 * réglementée), ou aucun échantillon suffisant.
 */
export function compareToMarket(
  bien: Property,
  commune: Commune,
  market: MarketData,
  rules: AidRules,
): MarcheComparaison | null {
  if (bien.categorie === "brs" || bien.categorie === "hlm") return null;
  const regime = bien.categorie === "neuf" ? "neuf" : "ancien";
  const min = rules.marche.minTransactions;

  const pick = (entry: MarketEntry | undefined): Stats | null => entry?.[bien.type][regime] ?? null;
  const local = pick(market.communes[commune.insee]);
  const agglo = pick(market.agglo);
  let reference: Stats | null = null;
  let niveau: "commune" | "agglo" = "commune";
  if (local && local.n >= min) reference = local;
  else if (agglo && agglo.n >= min) {
    reference = agglo;
    niveau = "agglo";
  }
  if (!reference || bien.surface <= 0) return null;

  const prixM2 = bien.prix / bien.surface;
  const ecartPct = prixM2 / reference.mediane - 1;
  const verdict: MarcheVerdict =
    ecartPct <= rules.marche.seuilSousMarche ? "sous" : ecartPct >= rules.marche.seuilAuDessus ? "au-dessus" : "dans";
  return {
    type: bien.type,
    regime,
    niveau,
    annees: market.annees,
    prixM2: Math.round(prixM2),
    reference,
    ecartPct,
    ecartEur: Math.round(bien.prix - reference.mediane * bien.surface),
    verdict,
  };
}
