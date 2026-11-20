import type { ReactNode } from "react";
import type { MarcheComparaison, MarcheVerdict } from "../types";
import { eur } from "../format";
import { marche as marcheData, zonage } from "../engine";

const VERDICT_LABEL: Record<MarcheVerdict, string> = {
  sous: "Sous le marché",
  dans: "Dans le marché",
  "au-dessus": "Au-dessus du marché",
};

const NIVEAU_LABEL: Record<MarcheComparaison["niveau"], string> = {
  commune: "commune de",
  epci: "intercommunalité",
  departement: "département",
};

const signed = (x: number, digits = 0): string => `${x >= 0 ? "+" : "−"}${Math.abs(x * 100).toFixed(digits)} %`;

/**
 * Détail « marché local » d'un bien : prix au m² comparé à la médiane DVF et à la fourchette
 * interquartile (Q1–Q3). Information seulement : n'entre ni dans le score ni dans le statut.
 */
export function MarketDetail({ m, zone, commune }: { m: MarcheComparaison | null; zone: string; commune: string }): ReactNode {
  return (
    <div className="market">
      <h4>Marché local (DVF) et zonage</h4>
      <p className="muted small">
        {commune} : zone {zone} (zonage ABC officiel, par code INSEE).
      </p>
      {m === null ? (
        <p className="muted small">
          Pas de comparaison au marché pour ce bien (BRS, vente HLM ou échantillon de ventes insuffisant).
        </p>
      ) : (
        <>
          <RangeBar m={m} />
          <table>
            <tbody>
              <tr><td>Prix au m² du bien</td><td>{eur(m.prixM2)}/m²</td></tr>
              <tr>
                <td>Médiane {m.type === "maison" ? "maisons" : "appartements"} {m.regime === "neuf" ? "neufs (VEFA)" : "anciens"}</td>
                <td>{eur(m.reference.mediane)}/m²</td>
              </tr>
              <tr><td>Fourchette Q1–Q3</td><td>{eur(m.reference.q1)} – {eur(m.reference.q3)}</td></tr>
              <tr>
                <td>Écart au marché</td>
                <td className={m.verdict === "au-dessus" ? "neg" : ""}>
                  {signed(m.ecartPct)} ({m.ecartEur >= 0 ? "+" : "−"}{eur(Math.abs(m.ecartEur))}) · {VERDICT_LABEL[m.verdict]}
                </td>
              </tr>
              <tr className="muted">
                <td>Échantillon</td>
                <td>{m.reference.n.toLocaleString("fr-FR")} ventes {m.annees[0]}–{m.annees[m.annees.length - 1]} · {NIVEAU_LABEL[m.niveau]} {m.referenceNom}</td>
              </tr>
            </tbody>
          </table>
        </>
      )}
      <p className="muted small">
        Sources : <a href={zonage.source.page} target="_blank" rel="noopener noreferrer">{zonage.source.nom}</a>{" "}
        ({zonage.source.licence}) ; <a href={marcheData.source.page} target="_blank" rel="noopener noreferrer">DVF</a>{" "}
        ({marcheData.source.licence}). Les ventes retenues sont les mutations d'un seul logement ; le prix au m² DVF est un
        repère, pas une estimation.
      </p>
    </div>
  );
}

/** Position du prix au m² du bien dans la fourchette Q1–Q3 de la médiane (SVG, échelle linéaire). */
function RangeBar({ m }: { m: MarcheComparaison }): ReactNode {
  const { q1, q3, mediane } = m.reference;
  const lo = Math.min(q1, m.prixM2) * 0.9;
  const hi = Math.max(q3, m.prixM2) * 1.1;
  const x = (v: number) => ((v - lo) / (hi - lo)) * 300;
  return (
    <svg viewBox="0 0 300 34" className="chart" role="img" aria-label={`Prix au m² du bien ${eur(m.prixM2)} contre médiane ${eur(mediane)}`}>
      <rect x={0} y={14} width={300} height={6} rx={3} fill="#e5e7eb" />
      <rect x={x(q1)} y={14} width={Math.max(2, x(q3) - x(q1))} height={6} rx={3} fill="#9db7d6" />
      <line x1={x(mediane)} x2={x(mediane)} y1={8} y2={26} stroke="#57606a" strokeWidth={2} />
      <circle cx={x(m.prixM2)} cy={17} r={6} fill={m.verdict === "au-dessus" ? "#d64545" : m.verdict === "sous" ? "#1f9d55" : "#3b82d4"} stroke="#fff" strokeWidth={2} />
      <text x={x(mediane)} y={6} fontSize="8" textAnchor="middle" fill="#57606a">médiane</text>
      <text x={x(m.prixM2)} y={33} fontSize="8" textAnchor="middle" fill="#1f2328">ce bien</text>
    </svg>
  );
}
