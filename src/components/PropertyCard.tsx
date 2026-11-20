import { useState } from "react";
import type { Evaluation } from "../types";
import { eur, pct } from "../format";
import { BudgetBar, PaymentChart, STATUT_LABEL } from "./Charts";

export function PropertyCard({ e, years }: { e: Evaluation; years: number }) {
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
        {open ? "Masquer le détail" : "Voir le détail du financement"}
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
              <tr><td>Prêt bancaire ({years} ans)</td><td>{eur(f.pretBancaire)}</td></tr>
              {f.manque > 0 && <tr className="neg"><td>Manque</td><td>{eur(f.manque)}</td></tr>}
              {e.redevanceBrs > 0 && <tr><td>Redevance BRS</td><td>{eur(e.redevanceBrs)}/mois</td></tr>}
              <tr><td>Mensualité maximale (pic)</td><td>{eur(e.mensualitePic)}</td></tr>
              <tr><td>Endettement phase 1</td><td>{pct(e.tauxEndettementPhase1, 1)}</td></tr>
              <tr><td>Charges + taxe foncière</td><td>{eur(e.chargesMensuellesBien)}/mois</td></tr>
            </tbody>
          </table>
          <PaymentChart e={e} years={years} />
          <ul className="aides">
            {e.aides.map((a) => (
              <li key={a.id} className={a.eligible ? "ok" : "ko"}>
                <strong>{a.libelle}</strong> — {a.eligible ? (a.montant > 0 ? eur(a.montant) : "éligible") : "non éligible"}
                <span className="muted"> {a.detail}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </article>
  );
}
