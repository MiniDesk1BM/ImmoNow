import { z } from "zod";
import type { AidRules, Commune, MarketData, Property, SavedState, Zone, ZonageData } from "./types";

/**
 * Validation à l'exécution des fichiers JSON (règles d'aides, communes, biens).
 * Les schémas sont STRICTS : une clé inconnue (faute de frappe) est une erreur, et les
 * contrôles croisés vérifient la cohérence interne (tranches PTZ, poids du score, ids uniques…).
 */

const zone = z.enum(["Abis", "A", "B1", "B2", "C"]);
const dpe = z.enum(["A", "B", "C", "D", "E", "F", "G"]);
const categorie = z.enum(["neuf", "ancien", "brs", "hlm"]);
const garantie = z.enum(["caution", "hypotheque"]);

const rate = z.number().min(0).max(1);
const montant = z.number().min(0);
const par5 = z.array(montant).length(5);
const parZone = <T extends z.ZodType>(s: T) => z.record(zone, s);
const croissant = (xs: number[]) => xs.every((x, i) => i === 0 || x >= (xs[i - 1] ?? 0));

const aidRulesSchema = z
  .strictObject({
    millesime: z.string().regex(/^\d{4}$/),
    avertissement: z.string().min(1),
    credit: z.strictObject({
      tauxEndettementMax: rate.positive(),
      assuranceAnnuelle: rate,
      tauxParDuree: z.record(z.string().regex(/^\d+$/), rate),
      dureeMinAns: z.number().int().positive(),
      dureeMaxAns: z.number().int().positive(),
      fraisDossier: z.strictObject({ pct: rate, min: montant, max: montant }),
      garantie: z.strictObject({ defaut: garantie, pct: z.record(garantie, rate) }),
      ajustementTauxMin: z.number().min(-0.05).max(0),
      ajustementTauxMax: z.number().min(0).max(0.1),
    }),
    fraisNotaire: z.record(categorie, rate),
    travauxParM2Dpe: z.record(dpe, montant),
    seuils: z.strictObject({
      resteAVivre: z.strictObject({ premierAdulte: montant, adulteSupp: montant, enfant: montant }),
      taxeFonciereAlerteAnnuelle: montant,
      chargesAlerteParM2Mensuel: montant,
      ecartOrange: rate,
    }),
    marche: z.strictObject({
      seuilSousMarche: z.number().min(-1).max(0),
      seuilAuDessus: z.number().min(0).max(1),
      minTransactions: z.number().int().min(1),
    }),

    score: z.strictObject({
      poids: z.strictObject({ financement: rate, endettement: rate, resteAVivre: rate, apport: rate }),
      margeEndettementCible: rate.positive().lt(1),
      resteAVivreCibleRatio: z.number().positive(),
      apportCiblePct: rate.positive(),
    }),
    ptz: z.strictObject({
      plafondsRessources: parZone(par5),
      plafondsOperation: parZone(par5),
      ratiosTranches: z.array(rate.positive()).min(1),
      quotites: z.strictObject({
        neufCollectif: z.array(rate),
        neufMaison: z.array(rate),
        ancien: z.array(rate),
      }),
      tranches: z.array(
        z.strictObject({ dureeTotaleAns: z.number().int().positive(), differeAns: z.number().int().min(0) }),
      ),
      ancienZonesEligibles: z.array(zone),
      ancienTravauxMinRatio: rate,
    }),
    brs: z.strictObject({ plafondsRessources: parZone(par5) }),
    actionLogement: z.strictObject({
      montantMax: montant,
      taux: rate,
      dureeAns: z.number().int().positive(),
      categories: z.array(categorie),
    }),
    ecoPtz: z.strictObject({ montantMax: montant, dureeAns: z.number().int().positive(), dpeEligibles: z.array(dpe) }),
    maPrimeRenov: z.strictObject({
      dpeEligibles: z.array(dpe),
      plafondTravaux: montant,
      taux: z.strictObject({ tresModeste: rate, modeste: rate, intermediaire: rate }),
      plafondsRevenus: z.strictObject({
        tresModeste: par5,
        modeste: par5,
        intermediaire: par5,
        parPersonneSupp: z.strictObject({ tresModeste: montant, modeste: montant, intermediaire: montant }),
      }),
    }),
    aideLocale: z.strictObject({ libelle: z.string().min(1), montant, dpeEligibles: z.array(dpe) }),
  })
  .superRefine((r, ctx) => {
    const fail = (message: string, path: (string | number)[]) => ctx.addIssue({ code: "custom", message, path });

    const keys = Object.keys(r.credit.tauxParDuree).map(Number);
    if (keys.length === 0) fail("Grille de taux vide.", ["credit", "tauxParDuree"]);
    else if (Math.max(...keys) < r.credit.dureeMaxAns) {
      fail(`Aucun taux défini pour la durée max (${r.credit.dureeMaxAns} ans).`, ["credit", "tauxParDuree"]);
    }
    if (r.credit.dureeMinAns > r.credit.dureeMaxAns) fail("dureeMinAns > dureeMaxAns.", ["credit", "dureeMinAns"]);
    if (r.credit.fraisDossier.min > r.credit.fraisDossier.max) {
      fail("fraisDossier.min > fraisDossier.max.", ["credit", "fraisDossier"]);
    }

    const p = r.score.poids;
    const total = p.financement + p.endettement + p.resteAVivre + p.apport;
    if (Math.abs(total - 1) > 1e-9) fail(`La somme des poids du score doit valoir 1 (actuel : ${total}).`, ["score", "poids"]);

    const n = r.ptz.ratiosTranches.length;
    if (!croissant(r.ptz.ratiosTranches) || r.ptz.ratiosTranches[n - 1] !== 1) {
      fail("ratiosTranches doit être croissant et se terminer par 1.", ["ptz", "ratiosTranches"]);
    }
    for (const k of ["neufCollectif", "neufMaison", "ancien"] as const) {
      if (r.ptz.quotites[k].length !== n) fail(`quotites.${k} doit avoir ${n} valeurs.`, ["ptz", "quotites", k]);
    }
    if (r.ptz.tranches.length !== n) fail(`tranches doit avoir ${n} entrées.`, ["ptz", "tranches"]);
    r.ptz.tranches.forEach((t, i) => {
      if (t.differeAns >= t.dureeTotaleAns) fail("differeAns doit être < dureeTotaleAns.", ["ptz", "tranches", i]);
    });

    const tableaux: [string, Record<string, number[]>][] = [
      ["ptz.plafondsRessources", r.ptz.plafondsRessources],
      ["ptz.plafondsOperation", r.ptz.plafondsOperation],
      ["brs.plafondsRessources", r.brs.plafondsRessources],
    ];
    for (const [nom, t] of tableaux) {
      for (const [z, vals] of Object.entries(t)) {
        if (!croissant(vals)) fail(`${nom}.${z} doit être croissant selon la taille du foyer.`, nom.split("."));
      }
    }
    for (const k of ["tresModeste", "modeste", "intermediaire"] as const) {
      if (!croissant(r.maPrimeRenov.plafondsRevenus[k])) {
        fail(`maPrimeRenov.plafondsRevenus.${k} doit être croissant.`, ["maPrimeRenov", "plafondsRevenus", k]);
      }
    }
  });

const inseeCode = z.string().regex(/^(\d{5}|2[AB]\d{3})$/);

/** Commune telle que stockée dans communes.mel.json : SANS zone (elle vient du zonage ABC par code INSEE). */
const communeSchema = z.strictObject({
  id: z.string().regex(/^[a-z0-9-]+$/),
  insee: inseeCode,
  nom: z.string().min(1),
  codePostal: z.string().regex(/^\d{5}$/),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

const sourceSchema = z.strictObject({
  nom: z.string().min(1),
  page: z.url({ protocol: /^https$/ }),
  licence: z.string().min(1),
  misAJour: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  perimetre: z.string().optional(),
  url: z.url({ protocol: /^https$/ }).optional(),
});

const zonageSchema = z.strictObject({
  source: sourceSchema,
  zones: z.record(inseeCode, zone),
});

const stats = z
  .strictObject({
    n: z.number().int().positive(),
    mediane: z.number().positive(),
    q1: z.number().positive(),
    q3: z.number().positive(),
  })
  .refine((s) => s.q1 <= s.mediane && s.mediane <= s.q3, "q1 ≤ médiane ≤ q3 attendu");
const bucket = z.strictObject({ ancien: stats.nullable(), neuf: stats.nullable() });
const marketEntry = z.strictObject({ appartement: bucket, maison: bucket });
const marketSchema = z.strictObject({
  source: sourceSchema,
  annees: z.array(z.number().int().min(2000).max(2100)).min(1),
  agglo: marketEntry,
  communes: z.record(inseeCode, marketEntry),
});

const propertySchema = z.strictObject({
  id: z.string().regex(/^[a-z0-9-]+$/),
  titre: z.string().min(1),
  communeId: z.string().min(1),
  type: z.enum(["maison", "appartement"]),
  categorie,
  prix: z.number().positive(),
  surface: z.number().positive(),
  chambres: z.number().int().min(0),
  dpe,
  taxeFonciereAnnuelle: montant,
  chargesMensuelles: montant,
  redevanceBrsMensuelle: montant.optional(),
});

function parseOrThrow<T extends z.ZodType>(schema: T, data: unknown, label: string): z.output<T> {
  const res = schema.safeParse(data);
  if (!res.success) throw new Error(`Données invalides (${label}) :\n${z.prettifyError(res.error)}`);
  return res.data;
}

function assertUniqueIds(items: { id: string }[], label: string): void {
  const seen = new Set<string>();
  for (const { id } of items) {
    if (seen.has(id)) throw new Error(`Données invalides (${label}) : id en double « ${id} ».`);
    seen.add(id);
  }
}

/** Valide un fichier de règles d'aides ; lève une erreur lisible au premier chargement. */
export function parseAidRules(data: unknown): AidRules {
  return parseOrThrow(aidRulesSchema, data, "règles d'aides");
}

export function parseZonage(data: unknown): ZonageData {
  return parseOrThrow(zonageSchema, data, "zonage ABC");
}

/** Valide les données de marché (DVF) ; chaque code INSEE de commune doit exister dans `communes` si fourni. */
export function parseMarket(data: unknown, insee?: string[]): MarketData {
  const m = parseOrThrow(marketSchema, data, "marché DVF");
  if (insee) {
    const known = new Set(insee);
    for (const code of Object.keys(m.communes)) {
      if (!known.has(code)) throw new Error(`Données invalides (marché DVF) : code INSEE inconnu « ${code} ».`);
    }
  }
  return m;
}

/**
 * Valide les communes et leur affecte la zone ABC par code INSEE (zonage officiel).
 * Toute commune absente du zonage est une erreur : pas de zone « par défaut ».
 */
export function parseCommunes(data: unknown, zonage: ZonageData): Commune[] {
  const parsed = parseOrThrow(z.array(communeSchema).min(1), data, "communes");
  assertUniqueIds(parsed, "communes");
  const seen = new Set<string>();
  return parsed.map((c) => {
    if (seen.has(c.insee)) throw new Error(`Données invalides (communes) : code INSEE en double « ${c.insee} ».`);
    seen.add(c.insee);
    const zone: Zone | undefined = zonage.zones[c.insee];
    if (!zone) throw new Error(`Données invalides (communes) : ${c.nom} (${c.insee}) absente du zonage ABC.`);
    return { ...c, zone };
  });
}

/** Valide les biens, y compris l'existence de leur commune et la cohérence BRS. */
export function parseProperties(data: unknown, communes: Commune[]): Property[] {
  const biens = parseOrThrow(z.array(propertySchema), data, "biens");
  assertUniqueIds(biens, "biens");
  const ids = new Set(communes.map((c) => c.id));
  for (const b of biens) {
    if (!ids.has(b.communeId)) throw new Error(`Données invalides (biens) : commune inconnue « ${b.communeId} » pour ${b.id}.`);
    if (b.categorie === "brs" && b.redevanceBrsMensuelle === undefined) {
      throw new Error(`Données invalides (biens) : redevanceBrsMensuelle requise pour le bien BRS ${b.id}.`);
    }
  }
  return biens;
}

const tri = z.enum(["pertinence", "score", "prixAsc", "prixDesc", "prixM2", "mensualite", "resteAVivre", "ecartMarche"]);
const entier = (min: number, max: number) => z.number().int().min(min).max(max);
const reel = (min: number, max: number) => z.number().min(min).max(max);

/** Même bornes que les champs du formulaire : une valeur hors bornes (stockage modifié à la main) est rejetée. */
const savedStateSchema = z.strictObject({
  profile: z.strictObject({
    foyer: z.strictObject({ adultes: entier(1, 4), enfants: entier(0, 6) }),
    primoAccedant: z.boolean(),
    salariePrive: z.boolean(),
    finances: z.strictObject({
      revenusNetsMensuels: reel(0, 100000),
      rfrN2: reel(0, 1000000),
      apport: reel(0, 1000000),
      mensualitesCredits: reel(0, 50000),
    }),
  }),
  criteria: z.strictObject({
    communeCentreId: z.string().min(1).max(64),
    rayonKm: reel(1, 30),
    types: z.array(z.enum(["maison", "appartement"])).max(2),
    surfaceMin: reel(0, 500),
    chambresMin: entier(0, 10),
    categories: z.array(categorie).max(4),
    accepteTravaux: z.boolean(),
  }),
  years: entier(1, 40),
  credit: z.strictObject({ ajustementTaux: reel(-0.05, 0.1), garantie }),
  tri,
  favoris: z.array(z.string().max(64)).max(200),
  comparaison: z.array(z.string().max(64)).max(3),
});

/**
 * Valide un état relu depuis le stockage local. Ne lève jamais : une donnée absente, corrompue ou
 * modifiée à la main renvoie `null` (l'application repart alors des valeurs par défaut).
 * `communeIds` / `bienIds` écartent les références obsolètes (données mises à jour entre deux visites).
 */
export function parseSavedState(raw: unknown, communeIds: string[], bienIds: string[]): SavedState | null {
  const res = savedStateSchema.safeParse(raw);
  if (!res.success) return null;
  const s = res.data;
  if (!communeIds.includes(s.criteria.communeCentreId)) return null;
  const biens = new Set(bienIds);
  const garde = (ids: string[]) => [...new Set(ids)].filter((id) => biens.has(id));
  return { ...s, favoris: garde(s.favoris), comparaison: garde(s.comparaison) };
}
