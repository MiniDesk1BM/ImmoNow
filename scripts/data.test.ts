import { describe, expect, it } from "vitest";
import { csvRows } from "./lib/csv.ts";
import { buildEntry, buildGroups, extractSales, pruneEntry, quantile, summarize } from "./lib/dvf.ts";
import { assignIds, parseGeoCommunes, slug } from "./lib/geo.ts";
import { parseZonageCsv } from "./lib/zonage.ts";

const HEAD =
  "id_mutation,numero_disposition,nature_mutation,valeur_fonciere,code_commune,type_local,surface_reelle_bati";
const dvf = (...lines: string[]) => [HEAD, ...lines].join("\n");
const MEL = new Set(["59350", "59512"]);

describe("csvRows", () => {
  it("gère guillemets, virgules et guillemets doublés dans un champ", () => {
    const rows = [...csvRows('a,"b,c","d ""x"" e"\n1,2,3\n')];
    expect(rows).toEqual([
      ["a", "b,c", 'd "x" e'],
      ["1", "2", "3"],
    ]);
  });
  it("accepte CRLF, lignes vides et absence de saut de ligne final", () => {
    expect([...csvRows("a;b\r\n\r\n1;2", ";")]).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });
});

describe("quantiles", () => {
  it("médiane et quartiles par interpolation", () => {
    expect(quantile([1, 2, 3, 4], 0.5)).toBe(2.5);
    expect(quantile([10], 0.25)).toBe(10);
    expect(quantile([1, 2, 3, 4, 5], 0.25)).toBe(2);
  });
  it("summarize : null si vide, sinon n/q1/médiane/q3", () => {
    expect(summarize([])).toBeNull();
    expect(summarize([3000, 1000, 2000])).toEqual({ n: 3, mediane: 2000, q1: 1500, q3: 2500 });
  });
});

describe("extractSales (DVF)", () => {
  it("retient une vente simple d'un seul logement, avec prix/m² = valeur / surface bâtie", () => {
    const s = extractSales(dvf("m1,000001,Vente,200000,59350,Appartement,50"), MEL);
    expect(s).toEqual([{ insee: "59350", type: "appartement", regime: "ancien", prixM2: 4000 }]);
  });
  it("VEFA = neuf", () => {
    const s = extractSales(dvf("m1,000001,Vente en l'état futur d'achèvement,300000,59350,Maison,100"), MEL);
    expect(s[0]?.regime).toBe("neuf");
    expect(s[0]?.type).toBe("maison");
  });
  it("ignore échanges, adjudications et communes hors périmètre", () => {
    const s = extractSales(
      dvf(
        "m1,000001,Echange,200000,59350,Appartement,50",
        "m2,000001,Adjudication,200000,59350,Appartement,50",
        "m3,000001,Vente,200000,75056,Appartement,50",
      ),
      MEL,
    );
    expect(s).toHaveLength(0);
  });
  it("ignore les mutations multi-logements ou multi-dispositions (prix non attribuable à un bien)", () => {
    const s = extractSales(
      dvf(
        "m1,000001,Vente,400000,59350,Appartement,50",
        "m1,000001,Vente,400000,59350,Appartement,60",
        "m2,000001,Vente,300000,59350,Maison,80",
        "m2,000002,Vente,300000,59350,Appartement,40",
      ),
      MEL,
    );
    expect(s).toHaveLength(0);
  });
  it("tolère une dépendance sur la même mutation (cave, garage)", () => {
    const s = extractSales(dvf("m1,000001,Vente,200000,59350,Appartement,50", "m1,000001,Vente,200000,59350,Dépendance,"), MEL);
    expect(s).toHaveLength(1);
  });
  it("écarte surfaces et prix/m² aberrants", () => {
    const s = extractSales(
      dvf(
        "m1,000001,Vente,1,59350,Appartement,50",
        "m2,000001,Vente,200000,59350,Appartement,2",
        "m3,000001,Vente,200000,59350,Appartement,",
        "m4,000001,Vente,5000000,59350,Appartement,50",
        "m5,000001,Vente,200000,59350,Appartement,900",
      ),
      MEL,
    );
    expect(s).toHaveLength(0);
  });
  it("échoue clairement si une colonne attendue disparaît du format DVF", () => {
    expect(() => extractSales("id_mutation,valeur_fonciere\nm1,1", MEL)).toThrow(/Colonne DVF absente/);
  });
  it("buildEntry sépare type et régime", () => {
    const e = buildEntry([
      { insee: "59350", type: "appartement", regime: "ancien", prixM2: 3000 },
      { insee: "59350", type: "appartement", regime: "neuf", prixM2: 5000 },
      { insee: "59350", type: "maison", regime: "ancien", prixM2: 2000 },
    ]);
    expect(e.appartement.ancien?.mediane).toBe(3000);
    expect(e.appartement.neuf?.mediane).toBe(5000);
    expect(e.maison.ancien?.mediane).toBe(2000);
    expect(e.maison.neuf).toBeNull();
  });
});

describe("buildGroups / pruneEntry (agrégats par maille)", () => {
  const vente = (insee: string, prixM2: number, type: "appartement" | "maison" = "appartement", regime: "ancien" | "neuf" = "ancien") => ({ insee, type, regime, prixM2 });
  const ventes = [
    ...Array.from({ length: 5 }, (_, i) => vente("59350", 3000 + i * 100)),
    ...Array.from({ length: 2 }, (_, i) => vente("59512", 1500 + i)),
  ];
  it("regroupe par clé et écarte les statistiques sous le seuil", () => {
    const g = buildGroups(ventes, (s) => s.insee, 5);
    expect(Object.keys(g)).toEqual(["59350"]);
    expect(g["59350"]?.appartement.ancien?.n).toBe(5);
    expect(g["59350"]?.maison.ancien).toBeNull();
  });
  it("ignore les ventes sans clé (commune hors périmètre) et trie les clés", () => {
    const g = buildGroups(ventes, (s) => (s.insee === "59350" ? "b" : s.insee === "59512" ? "a" : undefined), 1);
    expect(Object.keys(g)).toEqual(["a", "b"]);
  });
  it("pruneEntry : null si plus aucune statistique n'est exploitable", () => {
    expect(pruneEntry(buildEntry(ventes.slice(5)), 5)).toBeNull();
    expect(pruneEntry(buildEntry(ventes.slice(5)), 2)?.appartement.ancien?.n).toBe(2);
  });
});

describe("geo.api.gouv.fr", () => {
  const brut = (over: Record<string, unknown> = {}) => ({
    code: "62041",
    nom: "Arras",
    codesPostaux: ["62000"],
    centre: { type: "Point", coordinates: [2.78123456, 50.29123456] },
    codeEpci: "246200364",
    epci: { code: "246200364", nom: "CU d'Arras" },
    ...over,
  });
  it("normalise une commune (lat/lng arrondis, 1er code postal, EPCI)", () => {
    expect(parseGeoCommunes([brut()])).toEqual([
      { insee: "62041", nom: "Arras", codePostal: "62000", lat: 50.2912, lng: 2.7812, epci: "246200364", epciNom: "CU d'Arras" },
    ]);
  });
  it("refuse une réponse incomplète ou incohérente plutôt que de produire des données partielles", () => {
    expect(() => parseGeoCommunes([brut({ codesPostaux: [] })])).toThrow(/invalide/);
    expect(() => parseGeoCommunes([brut({ centre: undefined })])).toThrow(/invalide/);
    expect(() => parseGeoCommunes([brut({ code: "6204" })])).toThrow(/invalide/);
    expect(() => parseGeoCommunes([brut({ codeEpci: "111111111" })])).toThrow(/incohérent/);
  });
  const com = (insee: string, nom: string) => ({ insee, nom, codePostal: "59000", lat: 0, lng: 0, epci: "200000000", epciNom: "X" });
  it("slug : sans accents ni ligatures, séparé par des tirets", () => {
    expect(slug("Marcq-en-Barœul")).toBe("marcq-en-baroeul");
    expect(slug("Saint-Omer")).toBe("saint-omer");
    expect(slug("L'Écluse")).toBe("l-ecluse");
  });
  it("assignIds : conserve les identifiants connus et suffixe les homonymes par le code INSEE", () => {
    const cs = [com("59350", "Lille"), com("59529", "Saint-Aubin"), com("62742", "Saint-Aubin"), com("59999", "Roubaix")];
    const ids = assignIds(cs, new Map([["59350", "lille"], ["59999", "roubaix-historique"]]));
    expect(ids.get("59350")).toBe("lille");
    expect(ids.get("59999")).toBe("roubaix-historique");
    expect(ids.get("59529")).toBe("saint-aubin-59529");
    expect(ids.get("62742")).toBe("saint-aubin-62742");
    expect(new Set(ids.values()).size).toBe(4);
  });
  it("assignIds : un slug déjà pris par un identifiant connu est suffixé (pas de collision)", () => {
    const ids = assignIds([com("59350", "Lille"), com("62000", "Lille")], new Map([["59350", "lille"]]));
    expect(ids.get("62000")).toBe("lille-62000");
  });
});

describe("parseZonageCsv", () => {
  const csv = "\uFEFFCODGEO;DEP;LIBGEO;Zonage ABC en vigueur depuis le 26 juin 2026\n59350;59;Lille;A\n59512;59;Roubaix;B1\n01001;01;Ailleurs;C\n";
  it("lit CODGEO → zone, limité aux communes demandées, BOM toléré", () => {
    expect(parseZonageCsv(csv, MEL)).toEqual({ "59350": "A", "59512": "B1" });
  });
  it("refuse une zone inconnue et des colonnes inattendues", () => {
    expect(() => parseZonageCsv(csv.replace(";A\n", ";Z\n"), MEL)).toThrow(/zone inconnue/);
    expect(() => parseZonageCsv("X;Y\n1;2\n", MEL)).toThrow(/colonnes inattendues/);
  });
});
