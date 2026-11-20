import { describe, expect, it } from "vitest";
import { aidRules as r } from "../config";
import { borrowingCapacity, maxMonthlyPayment, pmt, summarizeBudget } from "./finance";
import { computeAides } from "./aides";
import { estimateTravaux, evaluate } from "./evaluate";
import { biens, communes, defaultCriteria, defaultProfile, runSearch } from "./index";
import { distanceKm } from "./search";
import type { Property, UserProfile } from "../types";

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
const profile = (over: Partial<UserProfile["finances"]> = {}, p: Partial<UserProfile> = {}): UserProfile => ({
  ...defaultProfile,
  ...p,
  finances: { ...defaultProfile.finances, ...over },
});

describe("finance", () => {
  it("pmt : 200 000 € à 3 % sur 20 ans ≈ 1 109,20 €", () => {
    expect(pmt(200000, 0.03, 20)).toBeCloseTo(1109.2, 1);
  });
  it("pmt à taux 0 = principal / mois", () => {
    expect(pmt(24000, 0, 2)).toBe(1000);
  });
  it("mensualité max = 35 % des revenus moins les crédits en cours", () => {
    expect(maxMonthlyPayment(profile({ revenusNetsMensuels: 4000, mensualitesCredits: 200 }), r)).toBeCloseTo(1200);
  });
  it("capacité d'emprunt cohérente avec la mensualité (aller-retour)", () => {
    const cap = borrowingCapacity(1300, 25, r);
    expect(cap).toBeGreaterThan(240000);
    expect(cap).toBeLessThan(300000);
  });
  it("net vendeur : frais de notaire plus lourds dans l'ancien que dans le neuf", () => {
    const s = summarizeBudget(profile(), r, 25);
    expect(s.netVendeurMax.neuf).toBeGreaterThan(s.netVendeurMax.ancien ?? 0);
  });
});

describe("aides", () => {
  it("PTZ refusé si non primo-accédant", () => {
    const a = computeAides(bien("b03"), commune("lille"), profile({}, { primoAccedant: false }), r, 0);
    expect(a.find((x) => x.id === "ptz")?.eligible).toBe(false);
  });
  it("PTZ refusé dans l'ancien en zone B1 (hors zones éligibles)", () => {
    const a = computeAides(bien("b01"), commune("lille"), profile(), r, 10000);
    expect(a.find((x) => x.id === "ptz")?.eligible).toBe(false);
  });
  it("PTZ accordé dans le neuf, quotité dépend de la tranche", () => {
    const a = computeAides(bien("b07"), commune("villeneuve"), profile(), r, 0);
    const ptz = a.find((x) => x.id === "ptz");
    expect(ptz?.eligible).toBe(true);
    expect(ptz?.montant).toBeGreaterThan(0);
    expect(ptz?.montant).toBeLessThanOrEqual(0.5 * 262000);
  });
  it("PTZ refusé si RFR au-dessus du plafond", () => {
    const a = computeAides(bien("b07"), commune("villeneuve"), profile({ rfrN2: 200000 }), r, 0);
    expect(a.find((x) => x.id === "ptz")?.eligible).toBe(false);
  });
  it("Action Logement réservé aux salariés du privé", () => {
    const a = computeAides(bien("b07"), commune("villeneuve"), profile({}, { salariePrive: false }), r, 0);
    expect(a.find((x) => x.id === "actionLogement")?.eligible).toBe(false);
  });
  it("BRS : plafond de ressources vérifié", () => {
    const ok = computeAides(bien("b11"), commune("tourcoing"), profile({ rfrN2: 30000 }), r, 0);
    const ko = computeAides(bien("b11"), commune("tourcoing"), profile({ rfrN2: 90000 }), r, 0);
    expect(ok.find((x) => x.id === "brs")?.eligible).toBe(true);
    expect(ko.find((x) => x.id === "brs")?.eligible).toBe(false);
  });
  it("aides rénovation uniquement dans l'ancien énergivore", () => {
    const g = bien("b08");
    const a = computeAides(g, commune("roubaix"), profile({ rfrN2: 20000 }), r, estimateTravaux(g, r));
    expect(a.find((x) => x.id === "maPrimeRenov")?.eligible).toBe(true);
    expect(a.find((x) => x.id === "ecoPtz")?.eligible).toBe(true);
    const neuf = computeAides(bien("b03"), commune("lille"), profile(), r, 0);
    expect(neuf.find((x) => x.id === "maPrimeRenov")).toBeUndefined();
  });
});

describe("evaluate", () => {
  it("le coût total = prix + notaire + travaux + frais de crédit", () => {
    const e = evaluate(bien("b08"), commune("roubaix"), profile(), r, 25);
    expect(e.coutTotal).toBe(e.bien.prix + e.fraisNotaire + e.travaux + e.fraisCredit.total);
    expect(e.fraisNotaire).toBe(Math.round(145000 * 0.08));
  });
  it("le financement couvre le besoin ou signale le manque", () => {
    const e = evaluate(bien("b17"), commune("lambersart"), profile(), r, 25);
    const f = e.financement;
    const total = f.apport + f.subventions + f.ptz + f.actionLogement + f.ecoPtz + f.pretBancaire + f.manque;
    expect(total).toBeGreaterThanOrEqual(e.coutTotal);
    expect(e.statut).toBe("rouge");
  });
  it("jamais au-dessus du taux d'endettement max (pic)", () => {
    for (const b of biens) {
      const e = evaluate(b, commune(b.communeId), profile(), r, 25);
      const taux = (profile().finances.mensualitesCredits + e.mensualitePic) / profile().finances.revenusNetsMensuels;
      expect(taux).toBeLessThanOrEqual(0.35 + 1e-6);
    }
  });
  it("un bien abordable est vert avec un bon profil", () => {
    const e = evaluate(bien("b09"), commune("roubaix"), profile({ revenusNetsMensuels: 6000, apport: 60000 }), r, 25);
    expect(e.statut).toBe("vert");
    expect(e.financement.manque).toBe(0);
  });
  it("alerte DPE G, taxe foncière élevée", () => {
    const g = evaluate(bien("b08"), commune("roubaix"), profile(), r, 25);
    expect(g.alertes.some((a) => a.message.includes("DPE G"))).toBe(true);
    const tf = evaluate(bien("b17"), commune("lambersart"), profile(), r, 25);
    expect(tf.alertes.some((a) => a.message.includes("Taxe foncière"))).toBe(true);
  });
  it("BRS refusé si RFR trop élevé : score 0 et rouge", () => {
    const e = evaluate(bien("b11"), commune("tourcoing"), profile({ rfrN2: 90000 }), r, 25);
    expect(e.scorePct).toBe(0);
    expect(e.statut).toBe("rouge");
  });
  it("redevance BRS incluse dans la mensualité", () => {
    const e = evaluate(bien("b11"), commune("tourcoing"), profile({ rfrN2: 30000 }), r, 25);
    expect(e.redevanceBrs).toBe(120);
    expect(e.mensualitePic).toBeGreaterThanOrEqual(120);
  });
});

describe("search", () => {
  it("distance Lille–Roubaix ≈ 10 km", () => {
    expect(distanceKm(commune("lille"), commune("roubaix"))).toBeGreaterThan(8);
    expect(distanceKm(commune("lille"), commune("roubaix"))).toBeLessThan(13);
  });
  it("le rayon filtre les biens", () => {
    const petit = runSearch(defaultProfile, { ...defaultCriteria, rayonKm: 2 }, 25);
    const grand = runSearch(defaultProfile, { ...defaultCriteria, rayonKm: 30 }, 25);
    expect(grand.length).toBeGreaterThan(petit.length);
  });
  it("résultats triés : verts avant oranges avant rouges", () => {
    const res = runSearch(defaultProfile, { ...defaultCriteria, rayonKm: 30, surfaceMin: 0, chambresMin: 0 }, 25);
    const ord = { vert: 0, orange: 1, rouge: 2 };
    for (let i = 1; i < res.length; i++) {
      expect(ord[res[i]!.statut]).toBeGreaterThanOrEqual(ord[res[i - 1]!.statut]);
    }
  });
});
