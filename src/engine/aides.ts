import type { Aide, AidRules, Commune, Property, UserProfile } from "../types";

export function householdSize(profile: UserProfile): number {
  return profile.foyer.adultes + profile.foyer.enfants;
}

/** Plafond d'un tableau indexé par taille de foyer (1..5 personnes, 5 au-delà). */
function bySize(table: number[], n: number): number {
  return table[Math.min(Math.max(n, 1), table.length) - 1] ?? 0;
}

const eur = (n: number) => `${Math.round(n).toLocaleString("fr-FR")} €`;

function computePtz(b: Property, c: Commune, p: UserProfile, r: AidRules, travaux: number): Aide {
  const base: Aide = { id: "ptz", libelle: "Prêt à Taux Zéro (PTZ)", eligible: false, montant: 0, nature: "pret", detail: "", taux: 0 };
  const n = householdSize(p);
  const rfr = p.finances.rfrN2;
  if (!p.primoAccedant) return { ...base, detail: "Réservé aux primo-accédants." };

  if (b.categorie === "ancien") {
    if (!r.ptz.ancienZonesEligibles.includes(c.zone)) {
      return { ...base, detail: `Ancien non éligible en zone ${c.zone} (zones ${r.ptz.ancienZonesEligibles.join(", ")} uniquement).` };
    }
    if (travaux < r.ptz.ancienTravauxMinRatio * (b.prix + travaux)) {
      return { ...base, detail: `Travaux estimés (${eur(travaux)}) < ${Math.round(r.ptz.ancienTravauxMinRatio * 100)} % du coût de l'opération.` };
    }
  }

  const plafondRessources = bySize(r.ptz.plafondsRessources[c.zone], n);
  if (rfr > plafondRessources) {
    return { ...base, detail: `RFR ${eur(rfr)} > plafond ${eur(plafondRessources)} (zone ${c.zone}, ${n} pers.).` };
  }

  const tranche = r.ptz.ratiosTranches.findIndex((ratio) => rfr <= ratio * plafondRessources);
  const quotites =
    b.categorie === "ancien" || b.categorie === "hlm"
      ? r.ptz.quotites.ancien
      : b.type === "maison"
        ? r.ptz.quotites.neufMaison
        : r.ptz.quotites.neufCollectif;
  const plafondOperation = bySize(r.ptz.plafondsOperation[c.zone], n);
  const assiette = Math.min(b.prix + (b.categorie === "ancien" ? travaux : 0), plafondOperation);
  const quotite = quotites[tranche] ?? 0;
  const t = r.ptz.tranches[tranche];
  if (!t || quotite === 0) return { ...base, detail: "Aucune tranche applicable." };

  const montant = Math.round(assiette * quotite);
  return {
    ...base,
    eligible: true,
    montant,
    dureeAns: t.dureeTotaleAns,
    differeAns: t.differeAns,
    detail: `Tranche ${tranche + 1} : ${Math.round(quotite * 100)} % de ${eur(assiette)}, ${t.dureeTotaleAns} ans dont ${t.differeAns} ans de différé.`,
  };
}

function mprCategory(rfr: number, n: number, r: AidRules): keyof AidRules["maPrimeRenov"]["taux"] | null {
  const { plafondsRevenus: pl } = r.maPrimeRenov;
  const limit = (key: "tresModeste" | "modeste" | "intermediaire") =>
    n <= 5 ? bySize(pl[key], n) : bySize(pl[key], 5) + (n - 5) * pl.parPersonneSupp[key];
  if (rfr <= limit("tresModeste")) return "tresModeste";
  if (rfr <= limit("modeste")) return "modeste";
  if (rfr <= limit("intermediaire")) return "intermediaire";
  return null;
}

export function computeAides(
  b: Property,
  c: Commune,
  p: UserProfile,
  r: AidRules,
  travaux: number,
): Aide[] {
  const aides: Aide[] = [];
  const n = householdSize(p);
  const ancien = b.categorie === "ancien" || b.categorie === "hlm";

  aides.push(computePtz(b, c, p, r, travaux));

  if (b.categorie === "brs") {
    const plafond = bySize(r.brs.plafondsRessources[c.zone], n);
    const ok = p.finances.rfrN2 <= plafond;
    aides.push({
      id: "brs",
      libelle: "Bail Réel Solidaire (BRS)",
      eligible: ok,
      montant: 0,
      nature: "dispositif",
      detail: ok
        ? `RFR ${eur(p.finances.rfrN2)} ≤ plafond ${eur(plafond)} (zone ${c.zone}).`
        : `RFR ${eur(p.finances.rfrN2)} > plafond BRS ${eur(plafond)} (zone ${c.zone}, ${n} pers.).`,
    });
  }

  const al = r.actionLogement;
  const alOk = p.salariePrive && al.categories.includes(b.categorie);
  aides.push({
    id: "actionLogement",
    libelle: "Prêt Action Logement",
    eligible: alOk,
    montant: alOk ? al.montantMax : 0,
    nature: "pret",
    taux: al.taux,
    dureeAns: al.dureeAns,
    detail: alOk
      ? `Jusqu'à ${eur(al.montantMax)} à ${(al.taux * 100).toFixed(1)} % sur ${al.dureeAns} ans.`
      : p.salariePrive
        ? "Non applicable à cette catégorie de bien."
        : "Réservé aux salariés du secteur privé.",
  });

  if (ancien) {
    const dpeOkEco = r.ecoPtz.dpeEligibles.includes(b.dpe) && travaux > 0;
    aides.push({
      id: "ecoPtz",
      libelle: "Éco-PTZ",
      eligible: dpeOkEco,
      montant: dpeOkEco ? Math.min(r.ecoPtz.montantMax, travaux) : 0,
      nature: "pret",
      taux: 0,
      dureeAns: r.ecoPtz.dureeAns,
      detail: dpeOkEco ? `Finance les travaux à 0 % sur ${r.ecoPtz.dureeAns} ans.` : "Pas de travaux de rénovation énergétique à financer.",
    });

    const cat = mprCategory(p.finances.rfrN2, n, r);
    const mprOk = r.maPrimeRenov.dpeEligibles.includes(b.dpe) && travaux > 0 && cat !== null;
    aides.push({
      id: "maPrimeRenov",
      libelle: "MaPrimeRénov'",
      eligible: mprOk,
      montant: mprOk && cat ? Math.round(Math.min(travaux, r.maPrimeRenov.plafondTravaux) * r.maPrimeRenov.taux[cat]) : 0,
      nature: "subvention",
      detail: mprOk && cat ? `Profil « ${cat} » : ${Math.round(r.maPrimeRenov.taux[cat] * 100)} % des travaux (plafonnés).` : cat === null ? "Revenus au-dessus des plafonds." : "DPE ou travaux non éligibles.",
    });

    const localOk = r.aideLocale.dpeEligibles.includes(b.dpe) && travaux > 0;
    aides.push({
      id: "aideLocale",
      libelle: r.aideLocale.libelle,
      eligible: localOk,
      montant: localOk ? r.aideLocale.montant : 0,
      nature: "subvention",
      detail: localOk ? "Forfait local pour la rénovation énergétique." : "DPE non éligible.",
    });
  }

  return aides;
}
