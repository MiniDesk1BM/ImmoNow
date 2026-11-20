import type {
  Alerte,
  AidRules,
  Commune,
  CreditOptions,
  Evaluation,
  LignePret,
  Property,
  Statut,
  UserProfile,
} from "../types";
import { computeAides } from "./aides";
import {
  bankPaymentFactor,
  creditFees,
  creditRate,
  defaultCreditOptions,
  loanForNeed,
  maxMonthlyPayment,
  monthlyAt,
  peakMonthly,
  pmt,
} from "./finance";
import { computeScore } from "./score";

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const eur = (n: number) => `${Math.round(n).toLocaleString("fr-FR")} €`;

export function estimateTravaux(b: Property, r: AidRules): number {
  if (b.categorie !== "ancien" && b.categorie !== "hlm") return 0;
  return Math.round(b.surface * r.travauxParM2Dpe[b.dpe]);
}

export function minResteAVivre(p: UserProfile, r: AidRules): number {
  const s = r.seuils.resteAVivre;
  return s.premierAdulte + Math.max(0, p.foyer.adultes - 1) * s.adulteSupp + p.foyer.enfants * s.enfant;
}

/**
 * Évalue la faisabilité d'un bien pour un profil.
 * Hypothèses :
 * - le prêt bancaire est dimensionné sur la mensualité PIC (PTZ remboursé inclus s'il chevauche
 *   le prêt principal) afin que le taux d'endettement max soit respecté à tout moment ;
 * - les frais de dossier et de garantie sont financés par le prêt bancaire (point fixe) et
 *   s'ajoutent au coût total ;
 * - `opts.ajustementTaux` décale la grille de taux (curseur « Et si… »).
 */
export function evaluate(
  bien: Property,
  commune: Commune,
  profile: UserProfile,
  rules: AidRules,
  years: number,
  opts: CreditOptions = defaultCreditOptions(rules),
): Evaluation {
  const travaux = estimateTravaux(bien, rules);
  const fraisNotaire = Math.round(bien.prix * rules.fraisNotaire[bien.categorie]);
  const coutBien = bien.prix + fraisNotaire + travaux;
  const aides = computeAides(bien, commune, profile, rules, travaux);
  const byId = (id: string) => aides.find((a) => a.id === id);

  const subventions = sum(aides.filter((a) => a.eligible && a.nature === "subvention").map((a) => a.montant));
  const apport = profile.finances.apport;
  let besoin = Math.max(0, coutBien - apport - subventions);

  const ptzAide = byId("ptz");
  const alAide = byId("actionLogement");
  const ecoAide = byId("ecoPtz");
  const ptz = Math.min(ptzAide?.eligible ? ptzAide.montant : 0, besoin);
  besoin -= ptz;
  const al = Math.min(alAide?.eligible ? alAide.montant : 0, besoin);
  besoin -= al;
  const eco = Math.min(ecoAide?.eligible ? ecoAide.montant : 0, besoin);
  besoin -= eco;

  const redevanceBrs = bien.categorie === "brs" ? (bien.redevanceBrsMensuelle ?? 0) : 0;

  // Lignes de prêts annexes
  const prets: LignePret[] = [];
  if (ptz > 0 && ptzAide?.dureeAns !== undefined) {
    const differe = ptzAide.differeAns ?? 0;
    prets.push({
      libelle: "PTZ",
      montant: ptz,
      mensualite: ptz / ((ptzAide.dureeAns - differe) * 12),
      debutAns: differe,
      finAns: ptzAide.dureeAns,
    });
  }
  if (al > 0 && alAide) {
    prets.push({
      libelle: "Action Logement",
      montant: al,
      mensualite: pmt(al, alAide.taux ?? 0, alAide.dureeAns ?? 20),
      debutAns: 0,
      finAns: alAide.dureeAns ?? 20,
    });
  }
  if (eco > 0 && ecoAide) {
    prets.push({
      libelle: "Éco-PTZ",
      montant: eco,
      mensualite: pmt(eco, 0, ecoAide.dureeAns ?? 20),
      debutAns: 0,
      finAns: ecoAide.dureeAns ?? 20,
    });
  }

  // Capacité bancaire résiduelle, calculée sur la mensualité maximale cumulée (pic)
  const mensualiteMax = maxMonthlyPayment(profile, rules);
  const factor = bankPaymentFactor(years, rules, opts.ajustementTaux);
  const pointsPic = [0, ...prets.map((p) => p.debutAns)].filter((t) => t < years);
  const pic = pointsPic.reduce((m, t) => Math.max(m, monthlyAt(prets, t)), 0);
  const capaciteBancaire = Math.max(0, Math.floor((mensualiteMax - redevanceBrs - pic) / factor));

  // Le prêt couvre le besoin ET ses propres frais (dossier + garantie).
  const pretNecessaire = loanForNeed(besoin, rules, opts.garantie);
  const pretBancaire = Math.min(pretNecessaire, capaciteBancaire);
  const frais = creditFees(pretBancaire, rules, opts.garantie);
  const manque = Math.max(0, besoin - Math.max(0, pretBancaire - frais.total));
  const coutTotal = coutBien + frais.total;

  if (pretBancaire > 0) {
    prets.push({
      libelle: "Prêt bancaire",
      montant: pretBancaire,
      mensualite: pretBancaire * factor,
      debutAns: 0,
      finAns: years,
    });
  }

  const mensualitePhase1 = monthlyAt(prets, 0) + redevanceBrs;
  const mensualitePic = peakMonthly(prets, Math.max(years, ...prets.map((p) => p.finAns))) + redevanceBrs;
  const { revenusNetsMensuels, mensualitesCredits } = profile.finances;
  const chargesMensuellesBien = bien.chargesMensuelles + bien.taxeFonciereAnnuelle / 12;
  const resteAVivre = revenusNetsMensuels - mensualitesCredits - mensualitePic - chargesMensuellesBien;
  const resteAVivreMin = minResteAVivre(profile, rules);
  const taux = (m: number) => (revenusNetsMensuels > 0 ? (mensualitesCredits + m) / revenusNetsMensuels : 1);

  const ressources = apport + subventions + ptz + al + eco + pretBancaire;
  const score = computeScore(
    { ressources, coutTotal, apport, tauxEndettement: taux(mensualitePic), resteAVivre, resteAVivreMin },
    rules,
  );

  const alertes: Alerte[] = [];
  const brs = byId("brs");
  const brsBloque = bien.categorie === "brs" && brs !== undefined && !brs.eligible;
  if (brsBloque) alertes.push({ niveau: "danger", message: `BRS inaccessible : ${brs?.detail ?? ""}` });
  if (bien.dpe === "G" || bien.dpe === "F") {
    alertes.push({ niveau: "danger", message: `DPE ${bien.dpe} (passoire thermique) : travaux estimés ${eur(travaux)}, restrictions de location, valeur de revente.` });
  } else if (bien.dpe === "E") {
    alertes.push({ niveau: "warning", message: `DPE E : travaux de rénovation énergétique à prévoir (~${eur(travaux)}).` });
  }
  if (bien.taxeFonciereAnnuelle > rules.seuils.taxeFonciereAlerteAnnuelle) {
    alertes.push({ niveau: "warning", message: `Taxe foncière élevée à ${commune.nom} : ${eur(bien.taxeFonciereAnnuelle)}/an.` });
  }
  const chargesM2 = bien.chargesMensuelles / bien.surface;
  if (chargesM2 > rules.seuils.chargesAlerteParM2Mensuel) {
    alertes.push({ niveau: "warning", message: `Charges de copropriété élevées : ${chargesM2.toFixed(1)} €/m²/mois.` });
  }
  if (bien.categorie === "hlm") {
    alertes.push({ niveau: "info", message: "Vente HLM : priorité aux locataires du parc et gardiens, délais de purge." });
  }
  if (bien.categorie === "brs") {
    alertes.push({ niveau: "info", message: `Redevance BRS de ${eur(redevanceBrs)}/mois pour le foncier ; revente encadrée.` });
  }
  if (resteAVivre < resteAVivreMin) {
    alertes.push({ niveau: resteAVivre < 0 ? "danger" : "warning", message: `Reste à vivre ${eur(resteAVivre)}/mois sous le seuil de confort (${eur(resteAVivreMin)}).` });
  }
  if (taux(mensualitePic) > rules.credit.tauxEndettementMax + 0.0001) {
    alertes.push({ niveau: "danger", message: "Taux d'endettement > 35 % (inclut la redevance)." });
  }

  const faisable = manque === 0 && !brsBloque;
  let statut: Statut;
  if (faisable && resteAVivre >= resteAVivreMin) statut = "vert";
  else if (!brsBloque && (faisable || ressources / coutTotal >= 1 - rules.seuils.ecartOrange) && resteAVivre >= 0) statut = "orange";
  else statut = "rouge";
  if (!faisable && statut === "orange") {
    alertes.push({ niveau: "warning", message: `Il manque ${eur(manque)} pour financer ce bien.` });
  } else if (!faisable && !brsBloque) {
    alertes.push({ niveau: "danger", message: `Il manque ${eur(manque)} : hors de portée en l'état.` });
  }

  return {
    bien,
    commune,
    travaux,
    fraisNotaire,
    fraisCredit: frais,
    tauxCredit: creditRate(years, rules, opts.ajustementTaux),
    coutTotal,
    scoreDetail: score.detail,
    aides,
    financement: { apport, subventions, ptz, actionLogement: al, ecoPtz: eco, pretBancaire, capaciteBancaire, manque },
    prets,
    redevanceBrs,
    mensualitePhase1,
    mensualitePic,
    mensualiteMax,
    tauxEndettementPhase1: taux(mensualitePhase1),
    tauxEndettementMax: rules.credit.tauxEndettementMax,
    chargesMensuellesBien,
    resteAVivre,
    resteAVivreMin,
    scorePct: brsBloque ? 0 : score.pct,
    statut,
    alertes,
  };
}
