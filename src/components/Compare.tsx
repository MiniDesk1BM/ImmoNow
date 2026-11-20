import type { ReactNode } from "react";
import type { Evaluation } from "../types";
import { eur, pct } from "../format";
import { STATUT_LABEL } from "./Charts";

interface Ligne {
  label: string;
  /** Valeur numérique comparée (null = non comparable) */
  val: (e: Evaluation) => number | null;
  /** « min » : la plus petite valeur est la meilleure ; « max » : la plus grande ; null : pas de meilleure valeur */
  meilleur: "min" | "max" | null;
  fmt: (e: Evaluation) => ReactNode;
}

const LIGNES: Ligne[] = [
  { label: "Prix", val: (e) => e.bien.prix, meilleur: "min", fmt: (e) => eur(e.bien.prix) },
  { label: "Prix au m²", val: (e) => e.bien.prix / e.bien.surface, meilleur: "min", fmt: (e) => `${eur(e.bien.prix / e.bien.surface)}/m²` },
  { label: "Coût total (frais, travaux, crédit)", val: (e) => e.coutTotal, meilleur: "min", fmt: (e) => eur(e.coutTotal) },
  { label: "Mensualité", val: (e) => e.mensualitePhase1, meilleur: "min", fmt: (e) => eur(e.mensualitePhase1) },
  { label: "Mensualité maximale (pic)", val: (e) => e.mensualitePic, meilleur: "min", fmt: (e) => eur(e.mensualitePic) },
  { label: "Endettement phase 1", val: (e) => e.tauxEndettementPhase1, meilleur: "min", fmt: (e) => pct(e.tauxEndettementPhase1, 1) },
  { label: "Reste à vivre", val: (e) => e.resteAVivre, meilleur: "max", fmt: (e) => eur(e.resteAVivre) },
  { label: "Charges + taxe foncière /mois", val: (e) => e.chargesMensuellesBien, meilleur: "min", fmt: (e) => eur(e.chargesMensuellesBien) },
  { label: "Prêt bancaire", val: (e) => e.financement.pretBancaire, meilleur: "min", fmt: (e) => eur(e.financement.pretBancaire) },
  { label: "PTZ + Action Logement + Éco-PTZ", val: (e) => e.financement.ptz + e.financement.actionLogement + e.financement.ecoPtz, meilleur: "max", fmt: (e) => eur(e.financement.ptz + e.financement.actionLogement + e.financement.ecoPtz) },
  { label: "Subventions", val: (e) => e.financement.subventions, meilleur: "max", fmt: (e) => eur(e.financement.subventions) },
  { label: "Manque de financement", val: (e) => e.financement.manque, meilleur: "min", fmt: (e) => eur(e.financement.manque) },
  {
    label: "Écart au marché (DVF)",
    val: (e) => e.marche?.ecartPct ?? null,
    meilleur: "min",
    fmt: (e) => (e.marche ? `${e.marche.ecartPct >= 0 ? "+" : "−"}${Math.abs(e.marche.ecartPct * 100).toFixed(0)} %` : "n/d"),
  },
  { label: "Surface", val: (e) => e.bien.surface, meilleur: "max", fmt: (e) => `${e.bien.surface} m²` },
  { label: "Chambres", val: (e) => e.bien.chambres, meilleur: "max", fmt: (e) => e.bien.chambres },
  { label: "DPE", val: () => null, meilleur: null, fmt: (e) => e.bien.dpe },
  { label: "Zone ABC", val: () => null, meilleur: null, fmt: (e) => e.commune.zone },
];

/** Indices (dans `evals`) ayant la meilleure valeur ; vide s'il n'y a pas de différence à signaler. */
function gagnants(evals: Evaluation[], l: Ligne): Set<number> {
  const vals = evals.map(l.val);
  const nums = vals.filter((v): v is number => v !== null);
  if (l.meilleur === null || nums.length < 2) return new Set();
  const cible = l.meilleur === "min" ? Math.min(...nums) : Math.max(...nums);
  if (nums.every((v) => v === cible)) return new Set();
  return new Set(vals.flatMap((v, i) => (v === cible ? [i] : [])));
}

interface Props {
  evals: Evaluation[];
  onRetirer: (id: string) => void;
  onVider: () => void;
}

/** Comparaison côte à côte de 2 à 3 biens, évalués avec le profil et le crédit courants. */
export function Compare({ evals, onRetirer, onVider }: Props) {
  return (
    <section className="panel compare" aria-label="Comparaison de biens">
      <div className="compare-head">
        <h2>Comparaison ({evals.length}/3)</h2>
        <button type="button" className="link" onClick={onVider}>Tout retirer</button>
      </div>
      {evals.length < 2 ? (
        <p className="muted small">Ajoutez au moins un autre bien avec « Comparer » pour les voir côte à côte.</p>
      ) : null}
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th scope="col"><span className="sr-only">Critère</span></th>
              {evals.map((e) => (
                <th scope="col" key={e.bien.id}>
                  {e.bien.titre}
                  <div className="muted small">{e.commune.nom} · {e.bien.categorie.toUpperCase()}</div>
                  <div className={`badge-inline ${e.statut}`}>{e.scorePct} % · {STATUT_LABEL[e.statut]}</div>
                  <button type="button" className="link" onClick={() => onRetirer(e.bien.id)} aria-label={`Retirer ${e.bien.titre} de la comparaison`}>Retirer</button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {LIGNES.map((l) => {
              const best = gagnants(evals, l);
              return (
                <tr key={l.label}>
                  <th scope="row">{l.label}</th>
                  {evals.map((e, i) => (
                    <td key={e.bien.id} className={best.has(i) ? "best" : ""}>
                      {l.fmt(e)}
                      {best.has(i) && <span className="sr-only"> (meilleure valeur)</span>}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="muted small">En vert : la valeur la plus favorable de la ligne. L'écart au marché est un repère (DVF), pas une estimation.</p>
    </section>
  );
}
