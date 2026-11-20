/**
 * Récupère les données ouvertes et génère src/data/communes.json, zonage.abc.json et marche.dvf.json
 * pour le Nord (59) et le Pas-de-Calais (62).
 *   - Communes, coordonnées, intercommunalités : geo.api.gouv.fr
 *   - Zonage ABC : data.gouv.fr (dataset « Liste des communes selon le zonage ABC », Licence Ouverte 2.0)
 *   - DVF : fichiers géolocalisés etalab/geo-dvf (files.data.gouv.fr), un fichier par département et par année
 * Usage : npm run data:fetch   (HTTPS uniquement, délai d'attente sur chaque appel, aucune clé requise)
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import type { MarketData } from "../src/types.ts";
import { buildGroups, extractSales, type Sale } from "./lib/dvf.ts";
import { assignIds, parseGeoCommunes, type GeoCommune } from "./lib/geo.ts";
import { parseZonageCsv } from "./lib/zonage.ts";

const DEPARTEMENTS = ["59", "62"];
const ANNEES = [2023, 2024, 2025];
const DATASET_ZONAGE = "656715871172d08f8f680063";
const TIMEOUT_MS = 180_000;

async function get(url: string): Promise<Buffer> {
  if (!url.startsWith("https://")) throw new Error(`HTTPS requis : ${url}`);
  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`HTTP ${res.status} pour ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

/** Texte UTF-8, avec décompression si le contenu est un gzip (signature 1f 8b). */
function toText(buf: Buffer): string {
  const raw = buf.length > 2 && buf[0] === 0x1f && buf[1] === 0x8b ? gunzipSync(buf) : buf;
  return raw.toString("utf8");
}

const getJson = async <T>(url: string): Promise<T> => JSON.parse((await get(url)).toString("utf8")) as T;
const writeJson = (path: string, data: unknown): void => writeFileSync(path, JSON.stringify(data, null, 2) + "\n");

async function main(): Promise<void> {
  // Le communes.json précédent sert à conserver les identifiants déjà utilisés (biens de démo, favoris enregistrés).
  const known = new Map<string, string>();
  if (existsSync("src/data/communes.json")) {
    for (const c of JSON.parse(readFileSync("src/data/communes.json", "utf8")) as { id: string; insee: string }[]) known.set(c.insee, c.id);
  }
  // Seuil sous lequel une statistique ne sera jamais utilisée : inutile de la livrer.
  const minN = (JSON.parse(readFileSync("src/config/aides.2025.json", "utf8")) as { marche: { minTransactions: number } }).marche.minTransactions;

  console.log("Communes (geo.api.gouv.fr)…");
  const geo: GeoCommune[] = [];
  const nomsDep: Record<string, string> = {};
  for (const dep of DEPARTEMENTS) {
    const communes = parseGeoCommunes(
      await getJson(`https://geo.api.gouv.fr/departements/${dep}/communes?fields=code,nom,codesPostaux,centre,codeEpci,epci&geometry=centre`),
    );
    const d = await getJson<{ code: string; nom: string }>(`https://geo.api.gouv.fr/departements/${dep}?fields=code,nom`);
    if (d.code !== dep || !d.nom) throw new Error(`Département ${dep} introuvable`);
    nomsDep[dep] = d.nom;
    geo.push(...communes);
    console.log(`  ${d.nom} : ${communes.length} communes`);
  }
  geo.sort((a, b) => a.insee.localeCompare(b.insee));
  const codes = new Set(geo.map((c) => c.insee));
  for (const insee of known.keys()) if (!codes.has(insee)) throw new Error(`Commune connue ${insee} absente de la source`);
  const ids = assignIds(geo, known);
  const nomsEpci = Object.fromEntries(geo.map((c) => [c.epci, c.epciNom]));

  writeJson(
    "src/data/communes.json",
    geo.map((c) => ({ id: ids.get(c.insee), insee: c.insee, epci: c.epci, nom: c.nom, codePostal: c.codePostal, lat: c.lat, lng: c.lng })),
  );

  console.log("Zonage ABC (data.gouv.fr)…");
  const dataset = await getJson<{
    resources: { title: string; format: string; url: string; last_modified: string }[];
    page: string;
  }>(`https://www.data.gouv.fr/api/1/datasets/${DATASET_ZONAGE}/`);
  const resource = dataset.resources.find((r) => r.format === "csv" && r.title.startsWith("Liste ensemble des communes"));
  if (!resource) throw new Error("Ressource « Liste ensemble des communes » introuvable");
  const zones = parseZonageCsv(toText(await get(resource.url)), codes);
  const manquantes = geo.filter((c) => !(c.insee in zones)).map((c) => c.insee);
  if (manquantes.length > 0) throw new Error(`Communes sans zone ABC (${manquantes.length}) : ${manquantes.slice(0, 10).join(", ")}…`);
  writeJson("src/data/zonage.abc.json", {
    source: {
      nom: resource.title.replace(/\.csv$/i, ""),
      page: dataset.page,
      url: resource.url,
      licence: "Licence Ouverte 2.0",
      misAJour: resource.last_modified.slice(0, 10),
    },
    zones: Object.fromEntries(Object.entries(zones).sort(([a], [b]) => a.localeCompare(b))),
  });
  console.log(`  ${Object.keys(zones).length} communes zonées (${resource.title})`);

  console.log("DVF (files.data.gouv.fr)…");
  const sales: Sale[] = [];
  const annees: number[] = [];
  for (const y of ANNEES) {
    // Une année n'est retenue que si TOUS les départements sont disponibles : sinon les médianes mélangeraient des périodes différentes.
    try {
      const parAnnee: Sale[] = [];
      for (const dep of DEPARTEMENTS) {
        const csv = toText(await get(`https://files.data.gouv.fr/geo-dvf/latest/csv/${y}/departements/${dep}.csv.gz`));
        const s = extractSales(csv, codes);
        console.log(`  ${y} / ${dep} : ${s.length} ventes retenues`);
        parAnnee.push(...s);
      }
      sales.push(...parAnnee);
      annees.push(y);
    } catch (e) {
      console.warn(`  ${y} ignoré : ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  if (annees.length === 0 || sales.length === 0) throw new Error("Aucune vente DVF récupérée");

  const depOf = new Map(geo.map((c) => [c.insee, c.insee.slice(0, 2)]));
  const epciOf = new Map(geo.map((c) => [c.insee, c.epci]));
  const epciStats = buildGroups(sales, (s) => epciOf.get(s.insee), minN);
  const marche: MarketData = {
    source: {
      nom: "Demandes de valeurs foncières géolocalisées (DVF)",
      page: "https://www.data.gouv.fr/datasets/demandes-de-valeurs-foncieres-geolocalisees",
      licence: "Licence Ouverte 2.0",
      perimetre: `${DEPARTEMENTS.map((d) => nomsDep[d]).join(" et ")} (${geo.length} communes), ventes de logements, prix au m² bâti`,
    },
    annees,
    departements: buildGroups(sales, (s) => depOf.get(s.insee), minN),
    epci: epciStats,
    communes: buildGroups(sales, (s) => s.insee, minN),
    noms: {
      departements: nomsDep,
      epci: Object.fromEntries(Object.keys(epciStats).map((k) => [k, nomsEpci[k] ?? k])),
    },
  };
  writeJson("src/data/marche.dvf.json", marche);
  console.log(
    `marche.dvf.json écrit (${sales.length} ventes, années ${annees.join(", ")} ; ${Object.keys(marche.communes).length} communes, ${Object.keys(marche.epci).length} EPCI avec statistiques).`,
  );
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
