import { describe, expect, it } from "vitest";
import { parseAidRules, parseCommunes, parseMarket, parseProperties, parseZonage } from "./schemas";
import rawRules from "./config/aides.2025.json";
import rawCommunes from "./data/communes.mel.json";
import rawBiens from "./data/biens.demo.json";
import rawZonage from "./data/zonage.abc.json";
import rawMarche from "./data/marche.dvf.json";

const clone = <T,>(x: T): T => structuredClone(x);
const zonage = () => parseZonage(rawZonage);
const rules = () => clone(rawRules) as Record<string, any>;

describe("schémas : fichiers livrés", () => {
  it("les règles 2025, les communes et les biens de démo sont valides", () => {
    expect(() => parseAidRules(rawRules)).not.toThrow();
    const communes = parseCommunes(rawCommunes, zonage());
    expect(() => parseProperties(rawBiens, communes)).not.toThrow();
    expect(() =>
      parseMarket(
        rawMarche,
        communes.map((c) => c.insee),
      ),
    ).not.toThrow();
  });
});

describe("schémas : règles d'aides", () => {
  it("rejette une clé inconnue (faute de frappe)", () => {
    const r = rules();
    r.credit.tauxEndettementMaxx = 0.35;
    expect(() => parseAidRules(r)).toThrow(/Données invalides/);
  });
  it("rejette une clé obligatoire manquante", () => {
    const r = rules();
    delete r.credit.fraisDossier;
    expect(() => parseAidRules(r)).toThrow();
  });
  it("rejette un taux hors [0, 1] (ex. 3,35 au lieu de 0,0335)", () => {
    const r = rules();
    r.credit.tauxParDuree["25"] = 3.35;
    expect(() => parseAidRules(r)).toThrow();
  });
  it("rejette des poids de score dont la somme n'est pas 1", () => {
    const r = rules();
    r.score.poids.apport = 0.5;
    expect(() => parseAidRules(r)).toThrow(/somme des poids/);
  });
  it("rejette des tranches PTZ incohérentes (nombre de quotités)", () => {
    const r = rules();
    r.ptz.quotites.neufMaison = [0.4, 0.3];
    expect(() => parseAidRules(r)).toThrow(/quotites\.neufMaison/);
  });
  it("rejette un différé PTZ ≥ à la durée totale", () => {
    const r = rules();
    r.ptz.tranches[0].differeAns = 30;
    expect(() => parseAidRules(r)).toThrow(/differeAns/);
  });
  it("rejette des plafonds non croissants avec la taille du foyer", () => {
    const r = rules();
    r.ptz.plafondsRessources.B1 = [80000, 51750, 62100, 72450, 82800];
    expect(() => parseAidRules(r)).toThrow(/croissant/);
  });
  it("rejette une grille de taux sans durée couvrant la durée max", () => {
    const r = rules();
    r.credit.tauxParDuree = { "10": 0.03 };
    expect(() => parseAidRules(r)).toThrow(/durée max/);
  });
  it("rejette fraisDossier.min > max", () => {
    const r = rules();
    r.credit.fraisDossier = { pct: 0.01, min: 2000, max: 1000 };
    expect(() => parseAidRules(r)).toThrow(/fraisDossier/);
  });
  it("rejette une zone ou un DPE inconnu", () => {
    const r = rules();
    r.ptz.plafondsRessources.D = [1, 2, 3, 4, 5];
    expect(() => parseAidRules(r)).toThrow();
    const r2 = rules();
    r2.ecoPtz.dpeEligibles = ["Z"];
    expect(() => parseAidRules(r2)).toThrow();
  });
});

describe("schémas : communes et biens", () => {
  const communes = () => parseCommunes(rawCommunes, zonage());
  const biens = () => clone(rawBiens) as Record<string, any>[];

  it("rejette une zone codée à la main, un code postal ou un INSEE invalide", () => {
    const c = clone(rawCommunes) as Record<string, any>[];
    c[0]!.zone = "B1";
    expect(() => parseCommunes(c, zonage())).toThrow();
    const c2 = clone(rawCommunes) as Record<string, any>[];
    c2[0]!.codePostal = "5900";
    expect(() => parseCommunes(c2, zonage())).toThrow();
    const c3 = clone(rawCommunes) as Record<string, any>[];
    c3[0]!.insee = "5935";
    expect(() => parseCommunes(c3, zonage())).toThrow();
  });
  it("rejette des ids de communes en double", () => {
    const c = clone(rawCommunes) as Record<string, any>[];
    c.push({ ...c[0]! });
    expect(() => parseCommunes(c, zonage())).toThrow(/double/);
  });
  it("rejette une commune absente du zonage ABC (pas de zone par défaut)", () => {
    const c = clone(rawCommunes) as Record<string, any>[];
    c[0]!.insee = "99999";
    expect(() => parseCommunes(c, zonage())).toThrow(/absente du zonage/);
  });
  it("chaque commune reçoit la zone du zonage ABC officiel (par code INSEE)", () => {
    const z = zonage();
    for (const c of parseCommunes(rawCommunes, z)) expect(c.zone).toBe(z.zones[c.insee]);
  });
  it("rejette un bien dont la commune n'existe pas", () => {
    const b = biens();
    b[0]!.communeId = "atlantide";
    expect(() => parseProperties(b, communes())).toThrow(/commune inconnue/);
  });
  it("rejette un prix négatif ou un DPE invalide", () => {
    const b = biens();
    b[0]!.prix = -1;
    expect(() => parseProperties(b, communes())).toThrow();
    const b2 = biens();
    b2[0]!.dpe = "H";
    expect(() => parseProperties(b2, communes())).toThrow();
  });
  it("rejette un bien BRS sans redevance", () => {
    const b = biens();
    const brs = b.find((x) => x.categorie === "brs")!;
    delete brs.redevanceBrsMensuelle;
    expect(() => parseProperties(b, communes())).toThrow(/redevanceBrsMensuelle/);
  });
  it("rejette des ids de biens en double", () => {
    const b = biens();
    b.push({ ...b[0]! });
    expect(() => parseProperties(b, communes())).toThrow(/double/);
  });
});

describe("schémas : zonage ABC et marché DVF", () => {
  it("rejette une zone inconnue dans le zonage", () => {
    const z = clone(rawZonage) as Record<string, any>;
    z.zones["59350"] = "D";
    expect(() => parseZonage(z)).toThrow();
  });
  it("rejette une source non HTTPS", () => {
    const z = clone(rawZonage) as Record<string, any>;
    z.source.page = "http://example.org";
    expect(() => parseZonage(z)).toThrow();
  });
  it("rejette des statistiques incohérentes (q1 > médiane)", () => {
    const m = clone(rawMarche) as Record<string, any>;
    m.agglo.appartement.ancien = { n: 10, mediane: 2000, q1: 3000, q3: 4000 };
    expect(() => parseMarket(m)).toThrow(/q1/);
  });
  it("rejette une commune de marché inconnue", () => {
    expect(() => parseMarket(rawMarche, ["59350"])).toThrow(/INSEE inconnu/);
  });
  it("rejette une clé inconnue dans les règles « marche »", () => {
    const r = rules();
    r.marche.seuilBizarre = 1;
    expect(() => parseAidRules(r)).toThrow();
  });
});
