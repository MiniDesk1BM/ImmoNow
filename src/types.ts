export type Garantie = "caution" | "hypotheque";
export type Zone = "Abis" | "A" | "B1" | "B2" | "C";
export type Dpe = "A" | "B" | "C" | "D" | "E" | "F" | "G";
export type Categorie = "neuf" | "ancien" | "brs" | "hlm";
export type TypeBien = "maison" | "appartement";

export interface UserProfile {
  foyer: { adultes: number; enfants: number };
  primoAccedant: boolean;
  salariePrive: boolean;
  finances: {
    revenusNetsMensuels: number;
    rfrN2: number;
    apport: number;
    mensualitesCredits: number;
  };
}

export interface SearchCriteria {
  communeCentreId: string;
  rayonKm: number;
  types: TypeBien[];
  surfaceMin: number;
  chambresMin: number;
  categories: Categorie[];
  accepteTravaux: boolean;
}

export interface Commune {
  id: string;
  nom: string;
  codePostal: string;
  zone: Zone;
  lat: number;
  lng: number;
}

export interface Property {
  id: string;
  titre: string;
  communeId: string;
  type: TypeBien;
  categorie: Categorie;
  prix: number;
  surface: number;
  chambres: number;
  dpe: Dpe;
  taxeFonciereAnnuelle: number;
  chargesMensuelles: number;
  redevanceBrsMensuelle?: number;
}

/** Règles annuelles (loi de finances) : fichier JSON src/config/aides.<millésime>.json */
export interface AidRules {
  millesime: string;
  avertissement: string;
  credit: {
    tauxEndettementMax: number;
    assuranceAnnuelle: number;
    tauxParDuree: Record<string, number>;
    dureeMinAns: number;
    dureeMaxAns: number;
    /** Frais de dossier bancaires : pourcentage du prêt, borné [min, max] en euros */
    fraisDossier: { pct: number; min: number; max: number };
    /** Garantie : pourcentage du prêt par type, avec un type retenu par défaut */
    garantie: { defaut: Garantie; pct: Record<Garantie, number> };
    /** Bornes (en points de taux) du curseur « Et si » appliqué à la grille */
    ajustementTauxMin: number;
    ajustementTauxMax: number;
  };
  fraisNotaire: Record<Categorie, number>;
  travauxParM2Dpe: Record<Dpe, number>;
  seuils: {
    resteAVivre: { premierAdulte: number; adulteSupp: number; enfant: number };
    taxeFonciereAlerteAnnuelle: number;
    chargesAlerteParM2Mensuel: number;
    ecartOrange: number;
  };
  /** Score de faisabilité 0-100 : moyenne pondérée de 4 composantes notées de 0 à 1 */
  score: {
    /** Poids des composantes, somme = 1 */
    poids: { financement: number; endettement: number; resteAVivre: number; apport: number };
    /** Endettement : note maximale si le taux est ≤ (1 − marge) × taux max ; nulle au taux max */
    margeEndettementCible: number;
    /** Reste à vivre : note maximale à partir de ce multiple du seuil de confort */
    resteAVivreCibleRatio: number;
    /** Apport personnel visé, en part du coût total, pour la note maximale */
    apportCiblePct: number;
  };
  ptz: {
    plafondsRessources: Record<Zone, number[]>;
    plafondsOperation: Record<Zone, number[]>;
    ratiosTranches: number[];
    quotites: { neufCollectif: number[]; neufMaison: number[]; ancien: number[] };
    tranches: { dureeTotaleAns: number; differeAns: number }[];
    ancienZonesEligibles: Zone[];
    ancienTravauxMinRatio: number;
  };
  brs: { plafondsRessources: Record<Zone, number[]> };
  actionLogement: { montantMax: number; taux: number; dureeAns: number; categories: Categorie[] };
  ecoPtz: { montantMax: number; dureeAns: number; dpeEligibles: Dpe[] };
  maPrimeRenov: {
    dpeEligibles: Dpe[];
    plafondTravaux: number;
    taux: { tresModeste: number; modeste: number; intermediaire: number };
    plafondsRevenus: {
      tresModeste: number[];
      modeste: number[];
      intermediaire: number[];
      parPersonneSupp: { tresModeste: number; modeste: number; intermediaire: number };
    };
  };
  aideLocale: { libelle: string; montant: number; dpeEligibles: Dpe[] };
}

export type AideId = "ptz" | "actionLogement" | "ecoPtz" | "maPrimeRenov" | "aideLocale" | "brs";

export interface Aide {
  id: AideId;
  libelle: string;
  eligible: boolean;
  /** Montant maximal mobilisable (prêt ou subvention). 0 pour un simple dispositif. */
  montant: number;
  nature: "pret" | "subvention" | "dispositif";
  detail: string;
  taux?: number;
  dureeAns?: number;
  differeAns?: number;
}

export interface Alerte {
  niveau: "info" | "warning" | "danger";
  message: string;
}

export interface CreditOptions {
  /** Écart (en points, ex. 0.005 = +0,5 pt) appliqué à la grille de taux */
  ajustementTaux: number;
  garantie: Garantie;
}

export interface LignePret {
  libelle: string;
  montant: number;
  mensualite: number;
  /** Année (depuis la signature) du début des remboursements */
  debutAns: number;
  finAns: number;
}

export type Statut = "vert" | "orange" | "rouge";

export interface ScoreDetail {
  financement: number;
  endettement: number;
  resteAVivre: number;
  apport: number;
}

export interface Evaluation {
  bien: Property;
  commune: Commune;
  travaux: number;
  fraisNotaire: number;
  /** Frais de dossier + garantie : calculés sur le prêt bancaire (itération à point fixe) */
  fraisCredit: { dossier: number; garantie: number; total: number };
  /** Taux nominal appliqué au prêt bancaire (grille + ajustement) */
  tauxCredit: number;
  /** Prix + notaire + travaux + frais de crédit */
  coutTotal: number;
  scoreDetail: ScoreDetail;
  aides: Aide[];
  financement: {
    apport: number;
    subventions: number;
    ptz: number;
    actionLogement: number;
    ecoPtz: number;
    pretBancaire: number;
    capaciteBancaire: number;
    manque: number;
  };
  prets: LignePret[];
  redevanceBrs: number;
  mensualitePhase1: number;
  /** Mensualité maximale cumulée sur toute la durée (après fin des différés) */
  mensualitePic: number;
  mensualiteMax: number;
  tauxEndettementPhase1: number;
  tauxEndettementMax: number;
  chargesMensuellesBien: number;
  resteAVivre: number;
  resteAVivreMin: number;
  scorePct: number;
  statut: Statut;
  alertes: Alerte[];
}
