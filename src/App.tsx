import { useEffect, useMemo, useState } from "react";
import type { CreditOptions, SavedState, SearchCriteria, Statut, TriKey, UserProfile } from "./types";
import { biens, communes, defaultCredit, defaultCriteria, defaultProfile, evaluateByIds, runSearch, sortBy, TRI_LABELS } from "./engine";
import { aidRules } from "./config";
import { browserStore, clearState, loadState, saveState } from "./storage";
import { Compare } from "./components/Compare";
import { ProfileForm } from "./components/ProfileForm";
import { PropertyCard } from "./components/PropertyCard";
import { Simulator } from "./components/Simulator";

type Tab = "profil" | "biens" | "simulateur";
const TABS: { id: Tab; label: string }[] = [
  { id: "profil", label: "1. Mon profil" },
  { id: "biens", label: "2. Les biens compatibles" },
  { id: "simulateur", label: "3. Simulateur & aides" },
];
const MAX_COMPARAISON = 3;
const TRI_KEYS = Object.keys(TRI_LABELS) as TriKey[];

const store = browserStore();
const DEFAUT: SavedState = {
  profile: defaultProfile,
  criteria: defaultCriteria,
  years: 25,
  credit: defaultCredit,
  tri: "pertinence",
  favoris: [],
  comparaison: [],
};
const toggleId = (ids: string[], id: string): string[] => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]);

export function App() {
  // Relu une seule fois au démarrage ; validé par zod, toute donnée invalide est ignorée.
  const [initial] = useState<SavedState>(() =>
    loadState(store, communes.map((c) => c.id), biens.map((b) => b.id)) ?? DEFAUT,
  );
  const [profile, setProfile] = useState<UserProfile>(initial.profile);
  const [criteria, setCriteria] = useState<SearchCriteria>(initial.criteria);
  const [years, setYears] = useState(initial.years);
  const [credit, setCredit] = useState<CreditOptions>(initial.credit);
  const [tri, setTri] = useState<TriKey>(initial.tri);
  const [favoris, setFavoris] = useState<string[]>(initial.favoris);
  const [comparaison, setComparaison] = useState<string[]>(initial.comparaison);
  const [tab, setTab] = useState<Tab>("biens");
  const [filtre, setFiltre] = useState<Statut | "tous" | "favoris">("tous");
  const [sauvegardeOk, setSauvegardeOk] = useState(true);

  useEffect(() => {
    setSauvegardeOk(saveState(store, { profile, criteria, years, credit, tri, favoris, comparaison }));
  }, [profile, criteria, years, credit, tri, favoris, comparaison]);

  const results = useMemo(() => runSearch(profile, criteria, years, credit), [profile, criteria, years, credit]);
  const favorisEval = useMemo(() => evaluateByIds(favoris, profile, years, credit), [favoris, profile, years, credit]);
  const compares = useMemo(() => evaluateByIds(comparaison, profile, years, credit), [comparaison, profile, years, credit]);

  // Les favoris restent visibles même s'ils sortent des critères de recherche.
  const base = filtre === "favoris" ? favorisEval : filtre === "tous" ? results : results.filter((r) => r.statut === filtre);
  const shown = useMemo(() => sortBy(base, tri), [base, tri]);
  const count = (s: Statut) => results.filter((r) => r.statut === s).length;

  const reinitialiser = () => {
    if (!window.confirm("Effacer vos données sauvegardées (profil, critères, favoris, comparaison) ?")) return;
    clearState(store);
    setProfile(DEFAUT.profile);
    setCriteria(DEFAUT.criteria);
    setYears(DEFAUT.years);
    setCredit(DEFAUT.credit);
    setTri(DEFAUT.tri);
    setFavoris([]);
    setComparaison([]);
    setFiltre("tous");
  };

  const profileForm = <ProfileForm profile={profile} criteria={criteria} onProfile={setProfile} onCriteria={setCriteria} />;
  const simulator = (
    <Simulator
      profile={profile}
      criteria={criteria}
      years={years}
      credit={credit}
      onYears={setYears}
      onProfile={setProfile}
      onCriteria={setCriteria}
      onCredit={setCredit}
    />
  );
  const list = (
    <section>
      <h2>Biens compatibles ({results.length})</h2>
      <div className="filters" role="group" aria-label="Filtrer par faisabilité">
        {(["tous", "vert", "orange", "rouge"] as const).map((f) => (
          <button key={f} type="button" className={filtre === f ? "active" : ""} onClick={() => setFiltre(f)}>
            {f === "tous" ? `Tous (${results.length})` : `${f[0]?.toUpperCase()}${f.slice(1)} (${count(f)})`}
          </button>
        ))}
        <button type="button" className={filtre === "favoris" ? "active" : ""} onClick={() => setFiltre("favoris")}>
          ★ Favoris ({favorisEval.length})
        </button>
      </div>
      <label className="sort">Trier par
        <select value={tri} onChange={(e) => setTri(e.target.value as TriKey)}>
          {TRI_KEYS.map((k) => (
            <option key={k} value={k}>{TRI_LABELS[k]}</option>
          ))}
        </select>
      </label>

      {comparaison.length > 0 && (
        <Compare
          evals={compares}
          onRetirer={(id) => setComparaison((c) => c.filter((x) => x !== id))}
          onVider={() => setComparaison([])}
        />
      )}

      {shown.length === 0 && (
        <p className="muted">
          {filtre === "favoris" ? "Aucun favori : cliquez sur « Mettre en favori » sur un bien." : "Aucun bien ne correspond. Élargissez le rayon ou les critères."}
        </p>
      )}
      <div className="grid">
        {shown.map((e) => (
          <PropertyCard
            key={e.bien.id}
            e={e}
            years={years}
            favori={favoris.includes(e.bien.id)}
            comparaison={comparaison.includes(e.bien.id)}
            comparaisonPleine={comparaison.length >= MAX_COMPARAISON}
            onFavori={(id) => setFavoris((f) => toggleId(f, id))}
            onComparaison={(id) => setComparaison((c) => toggleId(c, id))}
          />
        ))}
      </div>
    </section>
  );

  return (
    <div className="app">
      <header className="top">
        <h1>ImmoNow</h1>
        <p className="muted">L'achat immobilier réaliste : biens × profil financier × aides (démo Métropole Européenne de Lille, règles {aidRules.millesime})</p>
        <p className="muted small privacy">
          {sauvegardeOk
            ? "Vos données sont enregistrées uniquement dans ce navigateur (aucun envoi à un serveur)."
            : "Sauvegarde locale indisponible (stockage bloqué ou plein) : vos données seront perdues à la fermeture."}{" "}
          <button type="button" className="link" onClick={reinitialiser}>Tout réinitialiser</button>
        </p>
        <nav className="tabs" role="tablist">
          {TABS.map((t) => (
            <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={tab === t.id ? "active" : ""} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      {/* Desktop : 3 colonnes. Mobile : un onglet à la fois (classe .on). */}
      <main className="cols">
        <div className={tab === "profil" ? "col on" : "col"}>{profileForm}</div>
        <div className={tab === "biens" ? "col wide on" : "col wide"}>{list}</div>
        <div className={tab === "simulateur" ? "col on" : "col"}>{simulator}</div>
      </main>
    </div>
  );
}
