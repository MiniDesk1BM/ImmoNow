import { useState } from "react";
import type { Evaluation } from "../types";
import { eur, pct } from "../format";
import { BudgetBar, PaymentChart, STATUT_LABEL } from "./Charts";
import { MarketDetail } from "./MarketDetail";

const SCORE_LABELS: [keyof Evaluation["scoreDetail"], string][] = [
  ["financement", "Financement"],
  ["endettement", "Marge d'endettement"],
  ["resteAVivre", "Reste à vivre"],
  ["apport", "Apport"],
];

interface Props {
  e: Evaluation;
  years: number;
  favori: boolean;
  comparaison: boolean;
  /** Vrai si 3 biens sont déjà comparés et que celui-ci n'en fait pas partie */
  comparaisonPleine: boolean;
  onFavori: (id: string) => void;
  onComparaison: (id: string) => void;
}

export function PropertyCard({ e, years, favori, comparaison, comparaisonPleine, onFavori, onComparaison }: Props) {
  const [open, setOpen] = useState(false);
  const f = e.financement;
  return (
    <article className={`card ${e.statut}`}>
      <header>
        <div>
          <h3>{e.bien.titre}</h3>
          <p className="muted">
            {e.commune.nom} ({e.commune.codePostal}, zone {e.commune.zone}) · {e.bien.surface} m² · {e.bien.chambres} ch. · {e.bien.categorie.toUpperCase()} · DPE {e.bien.dpe}
          </p>
        </div>
        <div className={`badge ${e.statut}`} aria-label={`Score ${e.scorePct} %`}>
          <strong>{e.scorePct} %</strong>
          <span>{STATUT_LABEL[e.statut]}</span>
        </div>
      </header>

      <div className="actions">
        <button type="button" className={favori ? "toggle on" : "toggle"} aria-pressed={favori} onClick={() => onFavori(e.bien.id)}>
          {favori ? "★ Favori" : "☆ Mettre en favori"}
        </button>
        <button
          type="button"
          className={comparaison ? "toggle on" : "toggle"}
          aria-pressed={comparaison}
          disabled={!comparaison && comparaisonPleine}
          title={!comparaison && comparaisonPleine ? "3 biens maximum : retirez-en un d'abord" : undefined}
          onClick={() => onComparaison(e.bien.id)}
        >
          {comparaison ? "✓ Comparé" : "Comparer"}
        </button>
      </div>

      <dl className="kpis">
        <div><dt>Prix</dt><dd>{eur(e.bien.prix)}</dd></div>
        <div><dt>Coût total</dt><dd>{eur(e.coutTotal)}</dd></div>
        <div><dt>Mensualité</dt><dd>{eur(e.mensualitePhase1)}</dd></div>
        <div><dt>Reste à vivre</dt><dd className={e.resteAVivre < e.resteAVivreMin ? "neg" : ""}>{eur(e.resteAVivre)}</dd></div>
      </dl>

      <BudgetBar e={e} />

      {e.alertes.length > 0 && (
        <ul className="alertes">
          {e.alertes.map((a, i) => (
            <li key={i} className={a.niveau}>{a.message}</li>
          ))}
        </ul>
      )}

      <button type="button" className="link" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {open ? "Masquer le détail" : "Voir le détail (financement, marché local)"}
      </button>

      {open && (
        <div className="detail">
          <table>
            <tbody>
              <tr><td>Apport personnel</td><td>{eur(f.apport)}</td></tr>
              <tr><td>Subventions (MaPrimeRénov', local)</td><td>{eur(f.subventions)}</td></tr>
              <tr><td>PTZ</td><td>{eur(f.ptz)}</td></tr>
              <tr><td>Action Logement</td><td>{eur(f.actionLogement)}</td></tr>
              <tr><td>Éco-PTZ</td><td>{eur(f.ecoPtz)}</td></tr>
              <tr><td>Prêt bancaire ({years} ans à {pct(e.tauxCredit, 2)})</td><td>{eur(f.pretBancaire)}</td></tr>
              {e.fraisCredit.total > 0 && (
                <tr className="muted"><td>dont frais de dossier + garantie</td><td>{eur(e.fraisCredit.dossier)} + {eur(e.fraisCredit.garantie)}</td></tr>
              )}
              {f.manque > 0 && <tr className="neg"><td>Manque</td><td>{eur(f.manque)}</td></tr>}
              {e.redevanceBrs > 0 && <tr><td>Redevance BRS</td><td>{eur(e.redevanceBrs)}/mois</td></tr>}
              <tr><td>Mensualité maximale (pic)</td><td>{eur(e.mensualitePic)}</td></tr>
              <tr><td>Endettement phase 1</td><td>{pct(e.tauxEndettementPhase1, 1)}</td></tr>
              <tr><td>Charges + taxe foncière</td><td>{eur(e.chargesMensuellesBien)}/mois</td></tr>
            </tbody>
          </table>
          <PaymentChart e={e} years={years} />
          <h4>Détail du score</h4>
          <ul className="score-detail">
            {SCORE_LABELS.map(([key, label]) => (
              <li key={key}>
                <span>{label}</span>
                <meter min={0} max={1} value={e.scoreDetail[key]} aria-label={`${label} : ${Math.round(e.scoreDetail[key] * 100)} %`} />
                <span>{Math.round(e.scoreDetail[key] * 100)} %</span>
              </li>
            ))}
          </ul>
          <ul className="aides">
            {e.aides.map((a) => (
              <li key={a.id} className={a.eligible ? "ok" : "ko"}>
                <strong>{a.libelle}</strong> — {a.eligible ? (a.montant > 0 ? eur(a.montant) : "éligible") : "non éligible"}
                <span className="muted"> {a.detail}</span>
              </li>
            ))}
          </ul>
          <MarketDetail m={e.marche} zone={e.commune.zone} commune={e.commune.nom} />
        </div>
      )}
    </article>
  );
}
