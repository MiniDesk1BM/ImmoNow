import type { MarketBucket, MarketEntry, Stats } from "../../src/types.ts";
import { csvRows } from "./csv.ts";

export type TypeLocal = "appartement" | "maison";
export type Regime = "ancien" | "neuf";

export interface Sale {
  insee: string;
  type: TypeLocal;
  regime: Regime;
  prixM2: number;
}

/** Bornes de plausibilité : écartent les erreurs de saisie et les ventes atypiques (prix symboliques, lots mal décrits). */
export const BORNES = { surfaceMin: 9, surfaceMax: 400, prixM2Min: 500, prixM2Max: 15000 } as const;

const VEFA = "Vente en l'état futur d'achèvement";

/**
 * Extrait les ventes d'un fichier DVF géolocalisé (etalab/geo-dvf).
 * Règles volontairement conservatrices : on ne garde que les mutations « simples » portant sur
 * UN seul logement (appartement ou maison), une seule disposition, nature Vente ou VEFA.
 * Les dépendances/terrains sont donc ignorés (le prix inclut parfois un garage : léger biais haussier).
 */
export function extractSales(csv: string, communes: ReadonlySet<string>): Sale[] {
  const it = csvRows(csv);
  const first = it.next();
  if (first.done) return [];
  const head = first.value;
  const col = (name: string): number => {
    const i = head.indexOf(name);
    if (i < 0) throw new Error(`Colonne DVF absente : ${name}`);
    return i;
  };
  const iMut = col("id_mutation");
  const iDisp = col("numero_disposition");
  const iNat = col("nature_mutation");
  const iVal = col("valeur_fonciere");
  const iCom = col("code_commune");
  const iType = col("type_local");
  const iSurf = col("surface_reelle_bati");

  // Seules les 6 colonnes utiles sont conservées par ligne : sur un département entier, garder les
  // ~40 colonnes de chaque ligne ferait exploser la mémoire.
  interface Row {
    disp: string;
    nat: string;
    type: string;
    valeur: string;
    surface: string;
    insee: string;
  }
  const groups = new Map<string, Row[]>();
  for (const r of it) {
    const insee = r[iCom] ?? "";
    if (!communes.has(insee)) continue;
    const nat = r[iNat] ?? "";
    if (nat !== "Vente" && nat !== VEFA) continue;
    const row: Row = { disp: r[iDisp] ?? "", nat, type: r[iType] ?? "", valeur: r[iVal] ?? "", surface: r[iSurf] ?? "", insee };
    const key = r[iMut] ?? "";
    const g = groups.get(key);
    if (g) g.push(row);
    else groups.set(key, [row]);
  }

  const sales: Sale[] = [];
  for (const rows of groups.values()) {
    if (new Set(rows.map((r) => r.disp)).size > 1) continue;
    const locaux = rows.filter((r) => r.type === "Appartement" || r.type === "Maison");
    const local = locaux[0];
    if (locaux.length !== 1 || !local) continue;
    const valeur = Number.parseFloat(local.valeur);
    const surface = Number.parseFloat(local.surface);
    if (!(valeur > 0) || !(surface >= BORNES.surfaceMin) || surface > BORNES.surfaceMax) continue;
    const prixM2 = valeur / surface;
    if (prixM2 < BORNES.prixM2Min || prixM2 > BORNES.prixM2Max) continue;
    sales.push({
      insee: local.insee,
      type: local.type === "Maison" ? "maison" : "appartement",
      regime: local.nat === VEFA ? "neuf" : "ancien",
      prixM2,
    });
  }
  return sales;
}

/** Quantile par interpolation linéaire (méthode « type 7 »), sur un tableau déjà trié. */
export function quantile(sorted: number[], p: number): number {
  if (sorted.length === 0) return Number.NaN;
  const pos = (sorted.length - 1) * p;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  const a = sorted[lo] ?? 0;
  const b = sorted[hi] ?? a;
  return a + (b - a) * (pos - lo);
}

export function summarize(values: number[]): Stats | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  return {
    n: s.length,
    mediane: Math.round(quantile(s, 0.5)),
    q1: Math.round(quantile(s, 0.25)),
    q3: Math.round(quantile(s, 0.75)),
  };
}

function bucket(sales: Sale[], type: TypeLocal): MarketBucket {
  const of = (regime: Regime) => sales.filter((s) => s.type === type && s.regime === regime).map((s) => s.prixM2);
  return { ancien: summarize(of("ancien")), neuf: summarize(of("neuf")) };
}

export function buildEntry(sales: Sale[]): MarketEntry {
  return { appartement: bucket(sales, "appartement"), maison: bucket(sales, "maison") };
}

/**
 * Écarte les statistiques portant sur moins de `minN` ventes (inexploitables, et elles alourdiraient
 * inutilement le fichier livré). Renvoie null si plus rien ne subsiste.
 */
export function pruneEntry(e: MarketEntry, minN: number): MarketEntry | null {
  const keep = (s: Stats | null): Stats | null => (s && s.n >= minN ? s : null);
  const out: MarketEntry = {
    appartement: { ancien: keep(e.appartement.ancien), neuf: keep(e.appartement.neuf) },
    maison: { ancien: keep(e.maison.ancien), neuf: keep(e.maison.neuf) },
  };
  const vide = Object.values(out).every((b) => b.ancien === null && b.neuf === null);
  return vide ? null : out;
}

/** Agrège les ventes par clé (commune, EPCI, département…) ; les groupes sans statistique exploitable sont omis. */
export function buildGroups(sales: Sale[], keyOf: (s: Sale) => string | undefined, minN: number): Record<string, MarketEntry> {
  const groups = new Map<string, Sale[]>();
  for (const s of sales) {
    const k = keyOf(s);
    if (k === undefined) continue;
    const g = groups.get(k);
    if (g) g.push(s);
    else groups.set(k, [s]);
  }
  const out: Record<string, MarketEntry> = {};
  for (const k of [...groups.keys()].sort()) {
    const e = pruneEntry(buildEntry(groups.get(k) ?? []), minN);
    if (e) out[k] = e;
  }
  return out;
}
