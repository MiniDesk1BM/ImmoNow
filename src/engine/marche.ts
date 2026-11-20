import type { AidRules, Commune, MarcheComparaison, MarcheVerdict, MarketData, MarketEntry, Property, Stats } from "../types";

/**
 * Compare le prix au m² d'un bien à la médiane des ventes DVF comparables (même type de bien, même
 * régime ancien/neuf). Référence = la commune si elle a au moins `marche.minTransactions` ventes, sinon
 * son intercommunalité (EPCI), sinon son département : la maille la plus fine qui soit significative.
 *
 * Non comparable (null) : BRS (le prix exclut le foncier, redevance en sus), vente HLM (décote
 * réglementée), ou aucun échantillon suffisant à aucune maille.
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
  const niveaux = [
    { niveau: "commune", stats: pick(market.communes[commune.insee]), nom: commune.nom },
    { niveau: "epci", stats: pick(market.epci[commune.epci]), nom: market.noms.epci[commune.epci] ?? "intercommunalité" },
    { niveau: "departement", stats: pick(market.departements[commune.departement]), nom: market.noms.departements[commune.departement] ?? "département" },
  ] as const;
  const retenu = niveaux.find((n) => n.stats !== null && n.stats.n >= min);
  if (!retenu?.stats || bien.surface <= 0) return null;

  const reference = retenu.stats;
  const prixM2 = bien.prix / bien.surface;
  const ecartPct = prixM2 / reference.mediane - 1;
  const verdict: MarcheVerdict =
    ecartPct <= rules.marche.seuilSousMarche ? "sous" : ecartPct >= rules.marche.seuilAuDessus ? "au-dessus" : "dans";
  return {
    type: bien.type,
    regime,
    niveau: retenu.niveau,
    referenceNom: retenu.nom,
    annees: market.annees,
    prixM2: Math.round(prixM2),
    reference,
    ecartPct,
    ecartEur: Math.round(bien.prix - reference.mediane * bien.surface),
    verdict,
  };
}
