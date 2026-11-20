import { csvRows } from "./csv.ts";

export type ZoneAbc = "Abis" | "A" | "B1" | "B2" | "C";
const ZONES: ReadonlySet<string> = new Set(["Abis", "A", "B1", "B2", "C"]);

/**
 * Lit la « Liste des communes selon le zonage ABC » (data.gouv.fr, ministère de la Transition écologique) :
 * CSV séparé par « ; » avec CODGEO (code INSEE), DEP, LIBGEO et une dernière colonne « Zonage ABC … ».
 * Retourne code INSEE → zone, restreint aux communes demandées.
 */
export function parseZonageCsv(csv: string, communes: ReadonlySet<string>): Record<string, ZoneAbc> {
  const it = csvRows(csv, ";");
  const first = it.next();
  if (first.done) throw new Error("Zonage ABC : fichier vide");
  const head = first.value.map((h) => h.replace(/^\uFEFF/, "").trim());
  const iCode = head.indexOf("CODGEO");
  const iZone = head.findIndex((h) => h.toLowerCase().startsWith("zonage abc"));
  if (iCode < 0 || iZone < 0) throw new Error(`Zonage ABC : colonnes inattendues (${head.join(" | ")})`);

  const out: Record<string, ZoneAbc> = {};
  for (const r of it) {
    const code = (r[iCode] ?? "").trim();
    if (!communes.has(code)) continue;
    const zone = (r[iZone] ?? "").trim();
    if (!ZONES.has(zone)) throw new Error(`Zonage ABC : zone inconnue « ${zone} » pour ${code}`);
    out[code] = zone as ZoneAbc;
  }
  return out;
}
