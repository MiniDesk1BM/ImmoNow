import { describe, expect, it } from "vitest";
import { aidRules as r } from "../config";
import { compareToMarket } from "./marche";
import { evaluate } from "./evaluate";
import { biens, communes, defaultProfile, marche, zonage } from "./index";
import type { MarketData, Property } from "../types";

const commune = (id: string) => {
  const c = communes.find((x) => x.id === id);
  if (!c) throw new Error(`commune ${id}`);
  return c;
};
const bien = (id: string): Property => {
  const b = biens.find((x) => x.id === id);
  if (!b) throw new Error(`bien ${id}`);
  return b;
};
const stats = (mediane: number, n: number) => ({ n, mediane, q1: Math.round(mediane * 0.8), q3: Math.round(mediane * 1.2) });
const vide = { ancien: null, neuf: null };
const fake = (over: Partial<MarketData> = {}): MarketData => ({
  source: marche.source,
  annees: [2024],
  agglo: { appartement: { ancien: stats(3000, 500), neuf: stats(4000, 100) }, maison: { ...vide, ancien: stats(2500, 500) } },
  communes: {},
  ...over,
});

describe("données ouvertes livrées", () => {
  it("chaque commune a une zone issue du zonage ABC officiel (zone = zonage[insee])", () => {
    for (const c of communes) expect(c.zone).toBe(zonage.zones[c.insee]);
  });
  it("le zonage officiel diffère de la zone qui était codée à la main (ex. Lille en A, plus B1)", () => {
    expect(commune("lille").zone).toBe("A");
    expect(commune("wattrelos").zone).toBe("B1");
  });
  it("les statistiques DVF sont plausibles (prix au m² de l'ancien entre 1 000 et 6 000 €)", () => {
    for (const c of communes) {
      const s = marche.communes[c.insee]?.appartement.ancien;
      expect(s?.n ?? 0).toBeGreaterThan(30);
      expect(s!.mediane).toBeGreaterThan(1000);
      expect(s!.mediane).toBeLessThan(6000);
    }
  });
  it("neuf (VEFA) plus cher que l'ancien en agglomération (appartements)", () => {
    expect(marche.agglo.appartement.neuf!.mediane).toBeGreaterThan(marche.agglo.appartement.ancien!.mediane);
  });
});

describe("comparaison au marché", () => {
  const b = bien("b01"); // T3 Lille, ancien, 289 000 € / 68 m² = 4 250 €/m²
  const lille = commune("lille");

  it("calcule l'écart au prix médian de la commune quand l'échantillon est suffisant", () => {
    const m = fake({ communes: { [lille.insee]: { appartement: { ancien: stats(3500, 200), neuf: null }, maison: vide } } });
    const c = compareToMarket(b, lille, m, r);
    expect(c?.niveau).toBe("commune");
    expect(c?.prixM2).toBe(Math.round(289000 / 68));
    expect(c?.ecartPct).toBeCloseTo(289000 / 68 / 3500 - 1, 6);
    expect(c?.ecartEur).toBe(Math.round(289000 - 3500 * 68));
    expect(c?.verdict).toBe("au-dessus");
  });
  it("repli sur l'agglomération si la commune a moins de minTransactions ventes", () => {
    const m = fake({ communes: { [lille.insee]: { appartement: { ancien: stats(3500, r.marche.minTransactions - 1), neuf: null }, maison: vide } } });
    expect(compareToMarket(b, lille, m, r)?.niveau).toBe("agglo");
  });
  it("aucune comparaison sans échantillon suffisant nulle part", () => {
    const m = fake({ agglo: { appartement: { ancien: stats(3000, 5), neuf: null }, maison: vide } });
    expect(compareToMarket(b, lille, m, r)).toBeNull();
  });
  it("verdicts : sous / dans / au-dessus selon les seuils des règles", () => {
    const ref = 289000 / 68;
    const au = (med: number) =>
      compareToMarket(b, lille, fake({ communes: { [lille.insee]: { appartement: { ancien: stats(med, 200), neuf: null }, maison: vide } } }), r)?.verdict;
    expect(au(ref / (1 + r.marche.seuilAuDessus) - 50)).toBe("au-dessus");
    expect(au(ref)).toBe("dans");
    expect(au(ref / (1 + r.marche.seuilSousMarche) + 50)).toBe("sous");
  });
  it("neuf = VEFA, maison = référence maison", () => {
    const neuf = compareToMarket(bien("b03"), lille, fake(), r);
    expect(neuf?.regime).toBe("neuf");
    expect(neuf?.reference.mediane).toBe(4000);
    const maison = compareToMarket(bien("b04"), commune("marcq"), fake(), r);
    expect(maison?.type).toBe("maison");
    expect(maison?.reference.mediane).toBe(2500);
  });
  it("BRS et vente HLM ne sont pas comparables", () => {
    expect(compareToMarket(bien("b11"), commune("tourcoing"), fake(), r)).toBeNull();
    expect(compareToMarket(bien("b15"), commune("seclin"), fake(), r)).toBeNull();
  });
});

describe("marché dans l'évaluation", () => {
  it("evaluate expose la comparaison et ajoute une alerte quand le bien est au-dessus du marché", () => {
    const au = Object.values(
      biens.reduce<Record<string, ReturnType<typeof evaluate>>>((acc, b) => {
        acc[b.id] = evaluate(b, commune(b.communeId), defaultProfile, r, 25, undefined, marche);
        return acc;
      }, {}),
    ).filter((e) => e.marche?.verdict === "au-dessus");
    for (const e of au) expect(e.alertes.some((a) => a.message.includes("au marché local"))).toBe(true);
  });
  it("sans données de marché, pas de comparaison (comportement antérieur)", () => {
    const e = evaluate(bien("b01"), commune("lille"), defaultProfile, r, 25);
    expect(e.marche).toBeNull();
  });
  it("le marché n'influence ni le score ni le statut (information, pas décision)", () => {
    const a = evaluate(bien("b01"), commune("lille"), defaultProfile, r, 25);
    const z = evaluate(bien("b01"), commune("lille"), defaultProfile, r, 25, undefined, marche);
    expect(z.scorePct).toBe(a.scorePct);
    expect(z.statut).toBe(a.statut);
  });
});
