import { z } from "zod";

export interface GeoCommune {
  insee: string;
  nom: string;
  codePostal: string;
  lat: number;
  lng: number;
  /** Code SIREN de l'intercommunalité (EPCI) et son nom */
  epci: string;
  epciNom: string;
}

const geoSchema = z.array(
  z.object({
    code: z.string().regex(/^\d{5}$/),
    nom: z.string().min(1),
    codesPostaux: z.array(z.string().regex(/^\d{5}$/)).min(1),
    centre: z.object({ coordinates: z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]) }),
    codeEpci: z.string().regex(/^\d{9}$/),
    epci: z.object({ code: z.string().regex(/^\d{9}$/), nom: z.string().min(1) }),
  }),
);

const round4 = (x: number): number => Math.round(x * 1e4) / 1e4;

/**
 * Valide la réponse de geo.api.gouv.fr (`/departements/{dep}/communes`) : une réponse inattendue
 * (champ absent, format modifié) fait échouer le script plutôt que de produire des données partielles.
 */
export function parseGeoCommunes(data: unknown): GeoCommune[] {
  const res = geoSchema.safeParse(data);
  if (!res.success) throw new Error(`Réponse geo.api.gouv.fr invalide :\n${z.prettifyError(res.error)}`);
  return res.data.map((c) => {
    if (c.epci.code !== c.codeEpci) throw new Error(`EPCI incohérent pour ${c.code}`);
    return {
      insee: c.code,
      nom: c.nom,
      codePostal: c.codesPostaux[0] ?? "",
      lat: round4(c.centre.coordinates[1]),
      lng: round4(c.centre.coordinates[0]),
      epci: c.codeEpci,
      epciNom: c.epci.nom,
    };
  });
}

/** Identifiant lisible : minuscules, sans accents, lettres/chiffres séparés par « - » (« Marcq-en-Barœul » → « marcq-en-baroeul »). */
export function slug(nom: string): string {
  return nom
    .replace(/œ/gi, "oe")
    .replace(/æ/gi, "ae")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Attribue un identifiant stable à chaque commune : l'identifiant déjà connu (par code INSEE) est conservé,
 * sinon le slug du nom, suffixé du code INSEE en cas de doublon (homonymes).
 */
export function assignIds(communes: GeoCommune[], known: ReadonlyMap<string, string>): Map<string, string> {
  const ids = new Map<string, string>();
  const used = new Set<string>(known.values());
  for (const c of communes) {
    const k = known.get(c.insee);
    if (k) ids.set(c.insee, k);
  }
  const bySlug = new Map<string, number>();
  for (const c of communes) bySlug.set(slug(c.nom), (bySlug.get(slug(c.nom)) ?? 0) + 1);
  for (const c of communes) {
    if (ids.has(c.insee)) continue;
    const s = slug(c.nom);
    const id = (bySlug.get(s) ?? 0) > 1 || used.has(s) ? `${s}-${c.insee}` : s;
    used.add(id);
    ids.set(c.insee, id);
  }
  return ids;
}
