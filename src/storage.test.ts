import { describe, expect, it } from "vitest";
import { biens, communes, defaultCredit, defaultCriteria, defaultProfile } from "./engine";
import { clearState, loadState, saveState, STORAGE_KEY, type KeyValueStore } from "./storage";
import type { SavedState } from "./types";

const communeIds = communes.map((c) => c.id);
const bienIds = biens.map((b) => b.id);

function memoryStore(initial?: string): KeyValueStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  if (initial !== undefined) data.set(STORAGE_KEY, initial);
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

const valide = (): SavedState => ({
  profile: defaultProfile,
  criteria: defaultCriteria,
  years: 20,
  credit: { ...defaultCredit, ajustementTaux: 0.005 },
  tri: "prixM2",
  favoris: [bienIds[0] ?? "", bienIds[1] ?? ""],
  comparaison: [bienIds[0] ?? ""],
});

const charge = (raw: unknown) => loadState(memoryStore(JSON.stringify(raw)), communeIds, bienIds);

describe("sauvegarde locale", () => {
  it("relit exactement ce qui a été sauvegardé", () => {
    const store = memoryStore();
    expect(saveState(store, valide())).toBe(true);
    expect(loadState(store, communeIds, bienIds)).toEqual(valide());
  });

  it("renvoie null sans rien de sauvegardé, sans stockage ou après effacement", () => {
    expect(loadState(memoryStore(), communeIds, bienIds)).toBeNull();
    expect(loadState(null, communeIds, bienIds)).toBeNull();
    const store = memoryStore();
    saveState(store, valide());
    clearState(store);
    expect(loadState(store, communeIds, bienIds)).toBeNull();
  });

  it("ignore un contenu qui n'est pas du JSON", () => {
    expect(loadState(memoryStore("{pas du json"), communeIds, bienIds)).toBeNull();
    expect(loadState(memoryStore(""), communeIds, bienIds)).toBeNull();
  });

  it("ignore un JSON qui ne respecte pas le schéma", () => {
    expect(charge(null)).toBeNull();
    expect(charge([])).toBeNull();
    expect(charge({ ...valide(), tri: "inconnu" })).toBeNull();
    expect(charge({ ...valide(), clefInconnue: 1 })).toBeNull();
    expect(charge({ ...valide(), years: "20" })).toBeNull();
  });

  it("rejette les valeurs hors bornes (stockage modifié à la main)", () => {
    const s = valide();
    expect(charge({ ...s, profile: { ...s.profile, finances: { ...s.profile.finances, apport: -1 } } })).toBeNull();
    expect(charge({ ...s, profile: { ...s.profile, foyer: { adultes: 0, enfants: 0 } } })).toBeNull();
    expect(charge({ ...s, criteria: { ...s.criteria, rayonKm: 1000 } })).toBeNull();
    expect(charge({ ...s, criteria: { ...s.criteria, rayonKm: 150 } })).not.toBeNull();
    expect(charge({ ...s, credit: { ...s.credit, ajustementTaux: 5 } })).toBeNull();
    expect(charge({ ...s, years: 0 })).toBeNull();
    expect(charge({ ...s, comparaison: bienIds.slice(0, 4) })).toBeNull();
  });

  it("rejette une commune de référence inconnue", () => {
    const s = valide();
    expect(charge({ ...s, criteria: { ...s.criteria, communeCentreId: "atlantide" } })).toBeNull();
  });

  it("écarte les favoris obsolètes et les doublons sans rejeter le reste", () => {
    const s = valide();
    const id = bienIds[0] ?? "";
    const r = charge({ ...s, favoris: [id, id, "bien-disparu"], comparaison: ["bien-disparu"] });
    expect(r?.favoris).toEqual([id]);
    expect(r?.comparaison).toEqual([]);
  });

  it("ne plante pas si le stockage lève une exception (plein, bloqué)", () => {
    const casse: KeyValueStore = {
      getItem: () => {
        throw new Error("bloqué");
      },
      setItem: () => {
        throw new Error("plein");
      },
      removeItem: () => {
        throw new Error("bloqué");
      },
    };
    expect(loadState(casse, communeIds, bienIds)).toBeNull();
    expect(saveState(casse, valide())).toBe(false);
    expect(() => clearState(casse)).not.toThrow();
  });
});
