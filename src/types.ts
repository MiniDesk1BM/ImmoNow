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
  /** Code INSEE de la commune (clé de jointure zonage ABC / DVF) */
  insee: string;
  /** Code SIREN de l'intercommunalité (EPCI) : maille intermédiaire du repli de marché et périmètre de l'aide locale */
  epci: string;
  /** Code du département (2 premiers caractères du code INSEE) */
  departement: string;
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
  /** Comparaison au marché (DVF) : seuils de verdict et taille minimale d'échantillon */
  marche: {
    /** Écart (négatif) sous lequel le bien est « sous le marché », ex. -0.1 */
    seuilSousMarche: number;
    /** Écart (positif) au-dessus duquel le bien est « au-dessus du marché », ex. 0.1 */
    seuilAuDessus: number;
    /** Nombre minimal de ventes pour utiliser la médiane d'une commune */
    minTransactions: number;
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
  aideLocale: {
    libelle: string;
    montant: number;
    dpeEligibles: Dpe[];
    /** Intercommunalités (codes EPCI) où le dispositif existe ; ailleurs l'aide n'est pas proposée */
    epci: string[];
  };
}

/** Statistiques de prix au m² (DVF) sur un échantillon de ventes. */
export interface Stats {
  n: number;
  mediane: number;
  q1: number;
  q3: number;
}
export interface MarketBucket {
  ancien: Stats | null;
  /** Ventes en l'état futur d'achèvement (VEFA) */
  neuf: Stats | null;
}
export interface MarketEntry {
  appartement: MarketBucket;
  maison: MarketBucket;
}
/** Provenance d'un jeu de données ouvertes (affichée dans l'interface). */
export interface SourceInfo {
  nom: string;
  page: string;
  licence: string;
  /** Date de mise à jour de la ressource source (AAAA-MM-JJ) */
  misAJour?: string;
  perimetre?: string;
}
export interface ZonageData {
  source: SourceInfo;
  /** Code INSEE → zone ABC */
  zones: Record<string, Zone>;
}
export interface MarketData {
  source: SourceInfo;
  annees: number[];
  /** Clé : code du département */
  departements: Record<string, MarketEntry>;
  /** Clé : code EPCI (SIREN) */
  epci: Record<string, MarketEntry>;
  /** Clé : code INSEE */
  communes: Record<string, MarketEntry>;
  /** Libellés d'affichage des départements et des EPCI */
  noms: { departements: Record<string, string>; epci: Record<string, string> };
}

export type MarcheVerdict = "sous" | "dans" | "au-dessus";
export interface MarcheComparaison {
  type: TypeBien;
  regime: "ancien" | "neuf";
  /** Maille de la référence : la commune si assez de ventes, sinon repli sur son intercommunalité puis son département */
  niveau: "commune" | "epci" | "departement";
  /** Nom du territoire de référence (commune, intercommunalité ou département) */
  referenceNom: string;
  annees: number[];
  prixM2: number;
  reference: Stats;
  /** (prix au m² du bien / médiane) − 1 */
  ecartPct: number;
  /** Écart en euros sur le prix total du bien (positif = au-dessus du marché) */
  ecartEur: number;
  verdict: MarcheVerdict;
}

export type TriKey =
  | "pertinence"
  | "score"
  | "prixAsc"
  | "prixDesc"
  | "prixM2"
  | "mensualite"
  | "resteAVivre"
  | "ecartMarche";


/** État sauvegardé dans le navigateur (localStorage). Aucune donnée n'est envoyée à un serveur. */
export interface SavedState {
  profile: UserProfile;
  criteria: SearchCriteria;
  years: number;
  credit: CreditOptions;
  tri: TriKey;
  /** Identifiants des biens mis en favori */
  favoris: string[];
  /** Biens sélectionnés pour la comparaison (2 à 3 côte à côte) */
  comparaison: string[];
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
  /** Comparaison au marché (DVF) ; null si non comparable (BRS, échantillon insuffisant) */
  marche: MarcheComparaison | null;
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
