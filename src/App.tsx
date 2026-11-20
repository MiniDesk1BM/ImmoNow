import { useMemo, useState } from "react";
import type { CreditOptions, SearchCriteria, Statut, UserProfile } from "./types";
import { defaultCredit, defaultCriteria, defaultProfile, runSearch } from "./engine";
import { aidRules } from "./config";
import { ProfileForm } from "./components/ProfileForm";
import { PropertyCard } from "./components/PropertyCard";
import { Simulator } from "./components/Simulator";

type Tab = "profil" | "biens" | "simulateur";
const TABS: { id: Tab; label: string }[] = [
  { id: "profil", label: "1. Mon profil" },
  { id: "biens", label: "2. Les biens compatibles" },
  { id: "simulateur", label: "3. Simulateur & aides" },
];

export function App() {
  const [profile, setProfile] = useState<UserProfile>(defaultProfile);
  const [criteria, setCriteria] = useState<SearchCriteria>(defaultCriteria);
  const [years, setYears] = useState(25);
  const [credit, setCredit] = useState<CreditOptions>(defaultCredit);
  const [tab, setTab] = useState<Tab>("biens");
  const [filtre, setFiltre] = useState<Statut | "tous">("tous");

  const results = useMemo(() => runSearch(profile, criteria, years, credit), [profile, criteria, years, credit]);
  const shown = filtre === "tous" ? results : results.filter((r) => r.statut === filtre);
  const count = (s: Statut) => results.filter((r) => r.statut === s).length;

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
      </div>
      {shown.length === 0 && <p className="muted">Aucun bien ne correspond. Élargissez le rayon ou les critères.</p>}
      <div className="grid">
        {shown.map((e) => (
          <PropertyCard key={e.bien.id} e={e} years={years} />
        ))}
      </div>
    </section>
  );

  return (
    <div className="app">
      <header className="top">
        <h1>ImmoNow</h1>
        <p className="muted">L'achat immobilier réaliste : biens × profil financier × aides (démo Métropole Européenne de Lille, règles {aidRules.millesime})</p>
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
