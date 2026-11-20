import { describe, expect, it } from "vitest";
import { aidRules as r } from "../config";
import { computeScore, type ScoreInput } from "./score";
import { evaluate } from "./evaluate";
import { biens, communes, defaultProfile } from "./index";
import type { UserProfile } from "../types";

const base: ScoreInput = {
  ressources: 200_000,
  coutTotal: 200_000,
  apport: 20_000,
  tauxEndettement: 0.2,
  resteAVivre: 2_000,
  resteAVivreMin: 1_000,
};

describe("score", () => {
  it("score maximal : tout est financé avec de la marge", () => {
    const s = computeScore(base, r);
    expect(s.pct).toBe(100);
    expect(s.detail).toEqual({ financement: 1, endettement: 1, resteAVivre: 1, apport: 1 });
  });
  it("deux biens entièrement financés n'ont plus le même score (marge d'endettement)", () => {
    const aise = computeScore({ ...base, tauxEndettement: 0.2 }, r).pct;
    const juste = computeScore({ ...base, tauxEndettement: r.credit.tauxEndettementMax }, r).pct;
    expect(juste).toBeLessThan(aise);
  });
  it("à 35 % d'endettement, la note d'endettement est nulle", () => {
    expect(computeScore({ ...base, tauxEndettement: 0.35 }, r).detail.endettement).toBe(0);
  });
  it("le reste à vivre négatif donne une note nulle", () => {
    expect(computeScore({ ...base, resteAVivre: -50 }, r).detail.resteAVivre).toBe(0);
  });
  it("monotone : moins de ressources ou moins d'apport ne fait jamais monter le score", () => {
    const ref = computeScore(base, r).pct;
    expect(computeScore({ ...base, ressources: 150_000 }, r).pct).toBeLessThanOrEqual(ref);
    expect(computeScore({ ...base, apport: 0 }, r).pct).toBeLessThanOrEqual(ref);
  });
  it("entrées dégénérées : pas de NaN, score dans [0, 100]", () => {
    const s = computeScore({ ressources: 0, coutTotal: 0, apport: 0, tauxEndettement: 1, resteAVivre: 0, resteAVivreMin: 0 }, r);
    expect(Number.isFinite(s.pct)).toBe(true);
    expect(s.pct).toBeGreaterThanOrEqual(0);
    expect(s.pct).toBeLessThanOrEqual(100);
  });
  it("sur les biens de démo : score cohérent avec le statut et plus d'apport ne baisse pas le score", () => {
    const riche: UserProfile = { ...defaultProfile, finances: { ...defaultProfile.finances, apport: 90_000 } };
    for (const b of biens) {
      const c = communes.find((x) => x.id === b.communeId);
      if (!c) throw new Error(b.communeId);
      const a = evaluate(b, c, defaultProfile, r, 25);
      const z = evaluate(b, c, riche, r, 25);
      expect(a.scorePct).toBeGreaterThanOrEqual(0);
      expect(a.scorePct).toBeLessThanOrEqual(100);
      expect(z.scorePct).toBeGreaterThanOrEqual(a.scorePct - 1);
      if (a.statut === "rouge" && a.financement.manque > 0) expect(a.scorePct).toBeLessThan(100);
    }
  });
  it("un bien vert a un score nettement plus élevé qu'un bien rouge (en moyenne)", () => {
    const evals = biens.map((b) => {
      const c = communes.find((x) => x.id === b.communeId);
      if (!c) throw new Error(b.communeId);
      return evaluate(b, c, defaultProfile, r, 25);
    });
    const moy = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / Math.max(1, xs.length);
    const verts = evals.filter((e) => e.statut === "vert").map((e) => e.scorePct);
    const rouges = evals.filter((e) => e.statut === "rouge").map((e) => e.scorePct);
    if (verts.length && rouges.length) expect(moy(verts)).toBeGreaterThan(moy(rouges));
  });
});
