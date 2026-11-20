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
  };
  fraisNotaire: Record<Categorie, number>;
  travauxParM2Dpe: Record<Dpe, number>;
  seuils: {
    resteAVivre: { premierAdulte: number; adulteSupp: number; enfant: number };
    taxeFonciereAlerteAnnuelle: number;
    chargesAlerteParM2Mensuel: number;
    ecartOrange: number;
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

export interface LignePret {
  libelle: string;
  montant: number;
  mensualite: number;
  /** Année (depuis la signature) du début des remboursements */
  debutAns: number;
  finAns: number;
}

export type Statut = "vert" | "orange" | "rouge";

export interface Evaluation {
  bien: Property;
  commune: Commune;
  travaux: number;
  fraisNotaire: number;
  coutTotal: number;
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
