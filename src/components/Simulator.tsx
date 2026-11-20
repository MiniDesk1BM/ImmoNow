import type { SearchCriteria, UserProfile } from "../types";
import { aidRules } from "../config";
import { creditRate, summarizeBudget } from "../engine/finance";
import { eur, pct } from "../format";

interface Props {
  profile: UserProfile;
  criteria: SearchCriteria;
  years: number;
  onYears: (y: number) => void;
  onProfile: (p: UserProfile) => void;
  onCriteria: (c: SearchCriteria) => void;
}

/** Onglet 3 : simulateur « Et si… » (curseurs reliés à l'état global, recalcul instantané). */
export function Simulator({ profile, criteria, years, onYears, onProfile, onCriteria }: Props) {
  const b = summarizeBudget(profile, aidRules, years);
  const { credit } = aidRules;
  return (
    <section className="panel">
      <h2>Simulateur « Et si… »</h2>
      <label>Apport : {eur(profile.finances.apport)}
        <input type="range" min={0} max={200000} step={1000} value={profile.finances.apport} onChange={(e) => onProfile({ ...profile, finances: { ...profile.finances, apport: Number(e.target.value) } })} />
      </label>
      <label>Durée du prêt : {years} ans (taux {pct(creditRate(years, aidRules), 2)})
        <input type="range" min={credit.dureeMinAns} max={credit.dureeMaxAns} step={1} value={years} onChange={(e) => onYears(Number(e.target.value))} />
      </label>
      <label>Rayon de recherche : {criteria.rayonKm} km
        <input type="range" min={1} max={30} value={criteria.rayonKm} onChange={(e) => onCriteria({ ...criteria, rayonKm: Number(e.target.value) })} />
      </label>

      <h3>Votre capacité</h3>
      <dl className="kpis">
        <div><dt>Mensualité max ({pct(credit.tauxEndettementMax)})</dt><dd>{eur(b.mensualiteMax)}</dd></div>
        <div><dt>Capacité d'emprunt</dt><dd>{eur(b.capaciteEmprunt)}</dd></div>
        <div><dt>Budget global</dt><dd>{eur(b.budgetGlobal)}</dd></div>
      </dl>
      <h3>Prix net vendeur maximal (hors travaux)</h3>
      <dl className="kpis">
        <div><dt>Neuf / BRS (~2,5 %)</dt><dd>{eur(b.netVendeurMax.neuf ?? 0)}</dd></div>
        <div><dt>Ancien / HLM (~8 %)</dt><dd>{eur(b.netVendeurMax.ancien ?? 0)}</dd></div>
      </dl>
      <p className="muted small">{aidRules.avertissement} Millésime des règles : {aidRules.millesime}.</p>
    </section>
  );
}
