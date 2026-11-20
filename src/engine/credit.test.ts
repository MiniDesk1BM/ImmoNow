import { describe, expect, it } from "vitest";
import { aidRules as r } from "../config";
import { borrowingCapacity, bankPaymentFactor, creditFees, creditRate, loanForNeed, summarizeBudget } from "./finance";
import { evaluate } from "./evaluate";
import { biens, communes, defaultProfile } from "./index";
import type { CreditOptions, Property, UserProfile } from "../types";

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
const profile = (over: Partial<UserProfile["finances"]> = {}): UserProfile => ({
  ...defaultProfile,
  finances: { ...defaultProfile.finances, ...over },
});
const opts = (o: Partial<CreditOptions> = {}): CreditOptions => ({ ajustementTaux: 0, garantie: r.credit.garantie.defaut, ...o });

describe("frais de crédit", () => {
  it("aucun frais sans prêt", () => {
    expect(creditFees(0, r, "caution").total).toBe(0);
  });
  it("frais de dossier bornés par min et max", () => {
    expect(creditFees(10_000, r, "caution").dossier).toBe(r.credit.fraisDossier.min);
    expect(creditFees(900_000, r, "caution").dossier).toBe(r.credit.fraisDossier.max);
    expect(creditFees(120_000, r, "caution").dossier).toBe(Math.round(120_000 * r.credit.fraisDossier.pct));
  });
  it("la garantie suit le pourcentage du type retenu (hypothèque > caution)", () => {
    const c = creditFees(200_000, r, "caution");
    const h = creditFees(200_000, r, "hypotheque");
    expect(c.garantie).toBe(Math.round(200_000 * r.credit.garantie.pct.caution));
    expect(h.garantie).toBeGreaterThan(c.garantie);
  });
  it("le prêt finance le besoin ET ses propres frais (point fixe)", () => {
    for (const besoin of [1_000, 50_000, 187_654, 400_000]) {
      const loan = loanForNeed(besoin, r, "hypotheque");
      expect(loan - creditFees(loan, r, "hypotheque").total).toBeGreaterThanOrEqual(besoin);
      expect(loan - 1 - creditFees(loan - 1, r, "hypotheque").total).toBeLessThan(besoin);
    }
  });
  it("evaluate : prêt = besoin net + frais, coût total majoré des frais", () => {
    const e = evaluate(bien("b09"), commune("roubaix"), profile({ revenusNetsMensuels: 6000 }), r, 25, opts());
    expect(e.fraisCredit.total).toBeGreaterThan(0);
    expect(e.coutTotal).toBe(e.bien.prix + e.fraisNotaire + e.travaux + e.fraisCredit.total);
    const f = e.financement;
    expect(f.pretBancaire - e.fraisCredit.total + f.apport + f.subventions + f.ptz + f.actionLogement + f.ecoPtz).toBeGreaterThanOrEqual(
      e.coutTotal - e.fraisCredit.total,
    );
    expect(f.manque).toBe(0);
  });
  it("sans prêt bancaire, pas de frais", () => {
    const e = evaluate(bien("b09"), commune("roubaix"), profile({ apport: 400_000 }), r, 25, opts());
    expect(e.financement.pretBancaire).toBe(0);
    expect(e.fraisCredit.total).toBe(0);
  });
  it("le budget global déduit les frais de crédit", () => {
    const s = summarizeBudget(profile(), r, 25, opts());
    expect(s.fraisCredit.total).toBeGreaterThan(0);
    expect(s.budgetGlobal).toBe(30_000 + s.capaciteEmprunt + r.actionLogement.montantMax - s.fraisCredit.total);
  });
});

describe("curseur de taux", () => {
  it("l'ajustement décale la grille, avec un plancher à 0", () => {
    expect(creditRate(25, r, 0.01)).toBeCloseTo(creditRate(25, r) + 0.01);
    expect(creditRate(25, r, -1)).toBe(0);
  });
  it("un taux plus haut réduit la capacité d'emprunt et augmente la mensualité", () => {
    const base = borrowingCapacity(1300, 25, r, 0);
    const haut = borrowingCapacity(1300, 25, r, 0.02);
    const bas = borrowingCapacity(1300, 25, r, -0.01);
    expect(haut).toBeLessThan(base);
    expect(bas).toBeGreaterThan(base);
    expect(bankPaymentFactor(25, r, 0.02)).toBeGreaterThan(bankPaymentFactor(25, r, 0));
  });
  it("evaluate : le taux appliqué est exposé et le respect des 35 % tient aux bornes du curseur", () => {
    for (const aj of [r.credit.ajustementTauxMin, 0, r.credit.ajustementTauxMax]) {
      for (const b of biens) {
        const e = evaluate(b, commune(b.communeId), profile(), r, 25, opts({ ajustementTaux: aj }));
        expect(e.tauxCredit).toBeCloseTo(creditRate(25, r, aj));
        const taux = e.mensualitePic / profile().finances.revenusNetsMensuels;
        expect(taux).toBeLessThanOrEqual(r.credit.tauxEndettementMax + 1e-6);
      }
    }
  });
});
