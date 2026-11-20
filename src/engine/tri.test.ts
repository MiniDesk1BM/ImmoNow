import { describe, expect, it } from "vitest";
import { biens, communes, defaultCredit, defaultCriteria, defaultProfile, marche, runSearch, sortBy, TRI_LABELS } from "./index";
import { evaluate } from "./evaluate";
import { aidRules } from "../config";
import type { Evaluation, TriKey } from "../types";

const touteLaListe = (): Evaluation[] => runSearch(defaultProfile, { ...defaultCriteria, rayonKm: 30 }, 25, defaultCredit);
const cles = Object.keys(TRI_LABELS) as TriKey[];

describe("tri des biens", () => {
  it("chaque clé de tri conserve exactement les mêmes biens", () => {
    const base = touteLaListe();
    const ids = base.map((e) => e.bien.id).sort();
    for (const k of cles) expect(sortBy(base, k).map((e) => e.bien.id).sort()).toEqual(ids);
  });

  it("ne modifie pas le tableau d'origine", () => {
    const base = touteLaListe();
    const avant = base.map((e) => e.bien.id);
    sortBy(base, "prixDesc");
    expect(base.map((e) => e.bien.id)).toEqual(avant);
  });

  it("« pertinence » = tri par défaut du moteur (statut, score, prix)", () => {
    const base = touteLaListe();
    expect(sortBy([...base].reverse(), "pertinence").map((e) => e.bien.id)).toEqual(base.map((e) => e.bien.id));
  });

  it("trie dans le bon sens", () => {
    const base = touteLaListe();
    const croissant = (xs: number[]) => xs.every((x, i) => i === 0 || x >= (xs[i - 1] ?? 0));
    expect(croissant(sortBy(base, "prixAsc").map((e) => e.bien.prix))).toBe(true);
    expect(croissant(sortBy(base, "prixDesc").map((e) => -e.bien.prix))).toBe(true);
    expect(croissant(sortBy(base, "prixM2").map((e) => e.bien.prix / e.bien.surface))).toBe(true);
    expect(croissant(sortBy(base, "mensualite").map((e) => e.mensualitePhase1))).toBe(true);
    expect(croissant(sortBy(base, "score").map((e) => -e.scorePct))).toBe(true);
    expect(croissant(sortBy(base, "resteAVivre").map((e) => -e.resteAVivre))).toBe(true);
  });

  it("écart au marché : les biens sans comparaison (BRS…) sont en dernier", () => {
    const base = touteLaListe();
    const tri = sortBy(base, "ecartMarche");
    const premierNull = tri.findIndex((e) => e.marche === null);
    expect(premierNull).toBeGreaterThan(0);
    expect(tri.slice(premierNull).every((e) => e.marche === null)).toBe(true);
    const ecarts = tri.slice(0, premierNull).map((e) => e.marche?.ecartPct ?? 0);
    expect(ecarts.every((x, i) => i === 0 || x >= (ecarts[i - 1] ?? 0))).toBe(true);
  });

  it("est déterministe en cas d'égalité (prix puis identifiant)", () => {
    const b = biens[0];
    const c = communes.find((x) => x.id === b?.communeId);
    if (!b || !c) throw new Error("données de démo");
    const e1 = evaluate({ ...b, id: "zz-2" }, c, defaultProfile, aidRules, 25, defaultCredit, marche);
    const e2 = evaluate({ ...b, id: "aa-1" }, c, defaultProfile, aidRules, 25, defaultCredit, marche);
    for (const k of cles) {
      expect(sortBy([e1, e2], k).map((e) => e.bien.id)).toEqual(sortBy([e2, e1], k).map((e) => e.bien.id));
    }
  });
});
