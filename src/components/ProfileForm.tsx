import type { Categorie, SearchCriteria, TypeBien, UserProfile } from "../types";
import { communes, RAYON_MAX_KM } from "../engine";
import { CommuneSelect } from "./CommuneSelect";

interface Props {
  profile: UserProfile;
  criteria: SearchCriteria;
  onProfile: (p: UserProfile) => void;
  onCriteria: (c: SearchCriteria) => void;
}

const CATEGORIES: { id: Categorie; label: string }[] = [
  { id: "neuf", label: "Neuf" },
  { id: "ancien", label: "Ancien" },
  { id: "brs", label: "BRS" },
  { id: "hlm", label: "Vente HLM" },
];
const TYPES: { id: TypeBien; label: string }[] = [
  { id: "appartement", label: "Appartement" },
  { id: "maison", label: "Maison" },
];

const toggle = <T,>(list: T[], v: T): T[] => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
/** Borne une saisie numérique (validation côté client, le moteur ne fait pas confiance aux NaN). */
const num = (v: string, min: number, max: number): number => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min;
};

export function ProfileForm({ profile, criteria, onProfile, onCriteria }: Props) {
  const fin = profile.finances;
  const setFin = (k: keyof typeof fin, v: number) => onProfile({ ...profile, finances: { ...fin, [k]: v } });
  return (
    <form className="panel" onSubmit={(e) => e.preventDefault()}>
      <h2>Mon profil</h2>
      <fieldset>
        <legend>Foyer</legend>
        <label>Adultes
          <input type="number" min={1} max={4} value={profile.foyer.adultes} onChange={(e) => onProfile({ ...profile, foyer: { ...profile.foyer, adultes: num(e.target.value, 1, 4) } })} />
        </label>
        <label>Enfants à charge
          <input type="number" min={0} max={6} value={profile.foyer.enfants} onChange={(e) => onProfile({ ...profile, foyer: { ...profile.foyer, enfants: num(e.target.value, 0, 6) } })} />
        </label>
        <label className="check"><input type="checkbox" checked={profile.primoAccedant} onChange={(e) => onProfile({ ...profile, primoAccedant: e.target.checked })} /> Primo-accédant</label>
        <label className="check"><input type="checkbox" checked={profile.salariePrive} onChange={(e) => onProfile({ ...profile, salariePrive: e.target.checked })} /> Salarié du secteur privé</label>
      </fieldset>

      <fieldset>
        <legend>Finances</legend>
        <label>Revenus nets mensuels du foyer (€)
          <input type="number" min={0} step={100} value={fin.revenusNetsMensuels} onChange={(e) => setFin("revenusNetsMensuels", num(e.target.value, 0, 100000))} />
        </label>
        <label>RFR N-2 (€)
          <input type="number" min={0} step={500} value={fin.rfrN2} onChange={(e) => setFin("rfrN2", num(e.target.value, 0, 1000000))} />
        </label>
        <label>Crédits en cours (€/mois)
          <input type="number" min={0} step={10} value={fin.mensualitesCredits} onChange={(e) => setFin("mensualitesCredits", num(e.target.value, 0, 50000))} />
        </label>
      </fieldset>

      <fieldset>
        <legend>Critères du bien</legend>
        <CommuneSelect communes={communes} value={criteria.communeCentreId} onChange={(id) => onCriteria({ ...criteria, communeCentreId: id })} />
        <label>Rayon : {criteria.rayonKm} km
          <input type="range" min={1} max={RAYON_MAX_KM} value={criteria.rayonKm} onChange={(e) => onCriteria({ ...criteria, rayonKm: num(e.target.value, 1, RAYON_MAX_KM) })} />
        </label>
        <label>Surface minimale (m²)
          <input type="number" min={0} max={500} step={5} value={criteria.surfaceMin} onChange={(e) => onCriteria({ ...criteria, surfaceMin: num(e.target.value, 0, 500) })} />
        </label>
        <label>Chambres minimum
          <input type="number" min={0} max={10} value={criteria.chambresMin} onChange={(e) => onCriteria({ ...criteria, chambresMin: num(e.target.value, 0, 10) })} />
        </label>
        <div className="chips">
          {TYPES.map((t) => (
            <label key={t.id} className="check"><input type="checkbox" checked={criteria.types.includes(t.id)} onChange={() => onCriteria({ ...criteria, types: toggle(criteria.types, t.id) })} /> {t.label}</label>
          ))}
        </div>
        <div className="chips">
          {CATEGORIES.map((c) => (
            <label key={c.id} className="check"><input type="checkbox" checked={criteria.categories.includes(c.id)} onChange={() => onCriteria({ ...criteria, categories: toggle(criteria.categories, c.id) })} /> {c.label}</label>
          ))}
        </div>
        <label className="check"><input type="checkbox" checked={criteria.accepteTravaux} onChange={(e) => onCriteria({ ...criteria, accepteTravaux: e.target.checked })} /> J'accepte de gros travaux (DPE F/G)</label>
      </fieldset>
    </form>
  );
}
