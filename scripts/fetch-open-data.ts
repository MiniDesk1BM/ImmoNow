/**
 * Récupère les données ouvertes et génère src/data/zonage.abc.json et src/data/marche.dvf.json.
 *   - Zonage ABC : data.gouv.fr (dataset « Liste des communes selon le zonage ABC », Licence Ouverte 2.0)
 *   - DVF : fichiers géolocalisés etalab/geo-dvf (files.data.gouv.fr), départemental 59, Licence Ouverte 2.0
 *   - Communes de la MEL : geo.api.gouv.fr (EPCI 200093201)
 * Usage : npm run data:fetch   (HTTPS uniquement, délai d'attente sur chaque appel, aucune clé requise)
 */
import { readFileSync, writeFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import type { MarketData } from "../src/types.ts";
import { buildEntry, extractSales, type Sale } from "./lib/dvf.ts";
import { parseZonageCsv } from "./lib/zonage.ts";

const ANNEES = [2023, 2024, 2025];
const EPCI_MEL = "200093201";
const DATASET_ZONAGE = "656715871172d08f8f680063";
const TIMEOUT_MS = 120_000;

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

async function main(): Promise<void> {
  const demo = JSON.parse(readFileSync("src/data/communes.mel.json", "utf8")) as { insee: string; nom: string }[];
  const demoInsee = demo.map((c) => c.insee);

  console.log("Communes de la MEL (geo.api.gouv.fr)…");
  const mel = await getJson<{ code: string }[]>(`https://geo.api.gouv.fr/epcis/${EPCI_MEL}/communes?fields=code`);
  const melSet = new Set(mel.map((c) => c.code));
  for (const c of demoInsee) if (!melSet.has(c)) throw new Error(`Commune ${c} absente de la MEL`);
  console.log(`  ${melSet.size} communes`);

  console.log("Zonage ABC (data.gouv.fr)…");
  const dataset = await getJson<{
    resources: { title: string; format: string; url: string; last_modified: string }[];
    page: string;
    license: string;
  }>(`https://www.data.gouv.fr/api/1/datasets/${DATASET_ZONAGE}/`);
  const resource = dataset.resources.find((r) => r.format === "csv" && r.title.startsWith("Liste ensemble des communes"));
  if (!resource) throw new Error("Ressource « Liste ensemble des communes » introuvable");
  const zones = parseZonageCsv(toText(await get(resource.url)), melSet);
  const manquantes = [...melSet].filter((c) => !(c in zones));
  if (manquantes.length > 0) throw new Error(`Communes MEL sans zone : ${manquantes.join(", ")}`);
  writeFileSync(
    "src/data/zonage.abc.json",
    JSON.stringify(
      {
        source: {
          nom: resource.title.replace(/\.csv$/i, ""),
          page: dataset.page,
          url: resource.url,
          licence: "Licence Ouverte 2.0",
          misAJour: resource.last_modified.slice(0, 10),
        },
        zones: Object.fromEntries(Object.entries(zones).sort(([a], [b]) => a.localeCompare(b))),
      },
      null,
      2,
    ) + "\n",
  );
  console.log(`  ${Object.keys(zones).length} communes zonées (${resource.title})`);

  console.log("DVF (files.data.gouv.fr)…");
  const sales: Sale[] = [];
  const annees: number[] = [];
  for (const y of ANNEES) {
    try {
      const csv = toText(await get(`https://files.data.gouv.fr/geo-dvf/latest/csv/${y}/departements/59.csv.gz`));
      const s = extractSales(csv, melSet);
      console.log(`  ${y} : ${s.length} ventes retenues`);
      sales.push(...s);
      annees.push(y);
    } catch (e) {
      console.warn(`  ${y} ignoré : ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  if (annees.length === 0 || sales.length === 0) throw new Error("Aucune vente DVF récupérée");

  const marche: MarketData = {
    source: {
      nom: "Demandes de valeurs foncières géolocalisées (DVF)",
      page: "https://www.data.gouv.fr/datasets/demandes-de-valeurs-foncieres-geolocalisees",
      licence: "Licence Ouverte 2.0",
      perimetre: `Métropole Européenne de Lille (${melSet.size} communes), ventes de logements, prix au m² bâti`,
    },
    annees,
    agglo: buildEntry(sales),
    communes: Object.fromEntries(demoInsee.map((c) => [c, buildEntry(sales.filter((s) => s.insee === c))])),
  };
  writeFileSync("src/data/marche.dvf.json", JSON.stringify(marche, null, 2) + "\n");
  console.log(`marche.dvf.json écrit (${sales.length} ventes, années ${annees.join(", ")}).`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
