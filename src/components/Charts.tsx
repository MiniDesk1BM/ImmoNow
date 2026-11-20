import type { ReactNode } from "react";
import type { Evaluation, Statut } from "../types";
import { eur, pct } from "../format";

export const STATUT_LABEL: Record<Statut, string> = {
  vert: "Faisable",
  orange: "Limite",
  rouge: "Hors de portée",
};

const SEGMENTS: { key: string; label: string; color: string; value: (e: Evaluation) => number }[] = [
  { key: "prix", label: "Prix du bien", color: "#3b82d4", value: (e) => e.bien.prix },
  { key: "notaire", label: "Frais de notaire", color: "#7c5cd8", value: (e) => e.fraisNotaire },
  { key: "travaux", label: "Travaux", color: "#d98b2b", value: (e) => e.travaux },
  { key: "credit", label: "Frais de crédit", color: "#57606a", value: (e) => e.fraisCredit.total },
];

/** Barre de répartition du coût total, avec les aides déduites. */
export function BudgetBar({ e }: { e: Evaluation }): ReactNode {
  const segs = SEGMENTS.map((s) => ({ ...s, v: s.value(e) })).filter((s) => s.v > 0);
  const aides = e.financement.subventions + e.financement.ptz + e.financement.actionLogement + e.financement.ecoPtz;
  return (
    <figure className="budget" aria-label="Répartition du budget">
      <div className="bar" role="img" aria-label={`Coût total ${eur(e.coutTotal)}`}>
        {segs.map((s) => (
          <span key={s.key} style={{ width: `${(s.v / e.coutTotal) * 100}%`, background: s.color }} title={`${s.label} : ${eur(s.v)}`} />
        ))}
      </div>
      <figcaption>
        {segs.map((s) => (
          <span key={s.key} className="legend">
            <i style={{ background: s.color }} />
            {s.label} {eur(s.v)}
          </span>
        ))}
        <span className="legend muted">Aides déduites : {eur(aides)}</span>
      </figcaption>
    </figure>
  );
}

/** Évolution de la mensualité sur la durée (SVG, paliers). */
export function PaymentChart({ e, years }: { e: Evaluation; years: number }): ReactNode {
  const horizon = Math.max(years, ...e.prets.map((p) => p.finAns));
  const points = new Set<number>([0, horizon]);
  e.prets.forEach((p) => {
    points.add(p.debutAns);
    points.add(p.finAns);
  });
  const ts = [...points].sort((a, b) => a - b);
  const at = (t: number) =>
    e.prets.reduce((s, p) => (p.debutAns <= t && t < p.finAns ? s + p.mensualite : s), 0) + e.redevanceBrs;
  const steps = ts.slice(0, -1).map((t, i) => ({ x0: t, x1: ts[i + 1] ?? horizon, y: at(t) }));
  const ymax = Math.max(1, ...steps.map((s) => s.y));
  const W = 320;
  const H = 90;
  const sx = (t: number) => (t / horizon) * W;
  const sy = (v: number) => H - (v / ymax) * (H - 12);
  return (
    <svg viewBox={`0 0 ${W} ${H + 16}`} className="chart" role="img" aria-label="Évolution des mensualités">
      {steps.map((s, i) => (
        <g key={i}>
          <rect x={sx(s.x0)} y={sy(s.y)} width={Math.max(0, sx(s.x1) - sx(s.x0) - 1)} height={H - sy(s.y)} fill="#3b82d4" opacity={0.75} />
          <text x={sx(s.x0) + 3} y={sy(s.y) - 3} fontSize="9" fill="#57606a">
            {eur(s.y)}
          </text>
        </g>
      ))}
      <text x={0} y={H + 12} fontSize="9" fill="#57606a">0 an</text>
      <text x={W} y={H + 12} fontSize="9" fill="#57606a" textAnchor="end">{Math.round(horizon)} ans</text>
    </svg>
  );
}

export function Pct({ v }: { v: number }): ReactNode {
  return <>{pct(v, 1)}</>;
}
