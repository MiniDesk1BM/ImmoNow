import type { CreditOptions, Garantie, SearchCriteria, UserProfile } from "../types";
import { aidRules } from "../config";
import { creditRate, summarizeBudget } from "../engine/finance";
import { eur, pct } from "../format";

interface Props {
  profile: UserProfile;
  criteria: SearchCriteria;
  years: number;
  credit: CreditOptions;
  onYears: (y: number) => void;
  onProfile: (p: UserProfile) => void;
  onCriteria: (c: SearchCriteria) => void;
  onCredit: (c: CreditOptions) => void;
}

const GARANTIES: { id: Garantie; label: string }[] = [
  { id: "caution", label: "Caution" },
  { id: "hypotheque", label: "Hypothèque" },
];

/** Écart de taux affiché en points, ex. « +0,50 pt ». */
const signedPts = (x: number): string => `${x >= 0 ? "+" : "−"}${Math.abs(x * 100).toFixed(2).replace(".", ",")} pt`;

/** Onglet 3 : simulateur « Et si… » (curseurs reliés à l'état global, recalcul instantané). */
export function Simulator({ profile, criteria, years, credit, onYears, onProfile, onCriteria, onCredit }: Props) {
  const b = summarizeBudget(profile, aidRules, years, credit);
  const { credit: regles } = aidRules;
  const taux = creditRate(years, aidRules, credit.ajustementTaux);
  return (
    <section className="panel">
      <h2>Simulateur « Et si… »</h2>
      <label>Apport : {eur(profile.finances.apport)}
        <input type="range" min={0} max={200000} step={1000} value={profile.finances.apport} onChange={(e) => onProfile({ ...profile, finances: { ...profile.finances, apport: Number(e.target.value) } })} />
      </label>
      <label>Durée du prêt : {years} ans
        <input type="range" min={regles.dureeMinAns} max={regles.dureeMaxAns} step={1} value={years} onChange={(e) => onYears(Number(e.target.value))} />
      </label>
      <label>Taux du crédit : {pct(taux, 2)} ({signedPts(credit.ajustementTaux)} vs grille)
        <input
          type="range"
          aria-label="Ajustement du taux"
          min={regles.ajustementTauxMin}
          max={regles.ajustementTauxMax}
          step={0.0005}
          value={credit.ajustementTaux}
          onChange={(e) => onCredit({ ...credit, ajustementTaux: Number(e.target.value) })}
        />
      </label>
      <fieldset>
        <legend>Garantie du prêt</legend>
        {GARANTIES.map((g) => (
          <label key={g.id} className="check">
            <input type="radio" name="garantie" checked={credit.garantie === g.id} onChange={() => onCredit({ ...credit, garantie: g.id })} />
            {g.label} ({pct(regles.garantie.pct[g.id], 2)})
          </label>
        ))}
      </fieldset>
      <label>Rayon de recherche : {criteria.rayonKm} km
        <input type="range" min={1} max={30} value={criteria.rayonKm} onChange={(e) => onCriteria({ ...criteria, rayonKm: Number(e.target.value) })} />
      </label>

      <h3>Votre capacité</h3>
      <dl className="kpis">
        <div><dt>Mensualité max ({pct(regles.tauxEndettementMax)})</dt><dd>{eur(b.mensualiteMax)}</dd></div>
        <div><dt>Capacité d'emprunt</dt><dd>{eur(b.capaciteEmprunt)}</dd></div>
        <div><dt>Frais de crédit</dt><dd>{eur(b.fraisCredit.total)}</dd></div>
        <div><dt>Budget global</dt><dd>{eur(b.budgetGlobal)}</dd></div>
      </dl>
      <p className="muted small">
        Frais de crédit = dossier ({eur(b.fraisCredit.dossier)}) + garantie ({eur(b.fraisCredit.garantie)}), financés dans le prêt et déduits du budget.
      </p>
      <h3>Prix net vendeur maximal (hors travaux)</h3>
      <dl className="kpis">
        <div><dt>Neuf / BRS (~2,5 %)</dt><dd>{eur(b.netVendeurMax.neuf ?? 0)}</dd></div>
        <div><dt>Ancien / HLM (~8 %)</dt><dd>{eur(b.netVendeurMax.ancien ?? 0)}</dd></div>
      </dl>
      <p className="muted small">{aidRules.avertissement} Millésime des règles : {aidRules.millesime}.</p>
    </section>
  );
}
