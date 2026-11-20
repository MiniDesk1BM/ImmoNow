# AGENTS.md

This file provides guidance to agents when working with code in this repository.

## Commands
- `npm run dev` (bound to 127.0.0.1:5173; never bind 0.0.0.0), `npm run build` (runs `tsc --noEmit` first), `npm run typecheck`
- `npm test` = `vitest run`; collects `src/**/*.test.ts` and `scripts/**/*.test.ts` (see `vite.config.ts`), node environment (no component tests)
- `npm run data:fetch` regenerates `src/data/zonage.abc.json` and `src/data/marche.dvf.json` from data.gouv.fr (needs network, Node ≥ 22 for native `.ts`; ~1 min, downloads DVF 2021-2025 gz into gitignored `.bob/tmp/`). The browser never calls these hosts (no CORS): data is a committed snapshot.
- Single test: `npx vitest run -t "PTZ refusé si non primo-accédant"` or `npx vitest run src/engine/engine.test.ts -t "<name>"`

## Architecture (non-obvious)
- `src/engine/` is pure TS with no React imports; keep it that way (it is meant to move to a backend). Entry point: `runSearch()` in `src/engine/index.ts`.
- All aid rules/barèmes live in `src/config/aides.<year>.json`. Never hardcode thresholds/rates in code. A new field needs THREE edits: `AidRules` in `src/types.ts`, the zod schema in `src/schemas.ts`, and the JSON. The schemas are `strictObject` and validated at import time (`parseAidRules`, `parseCommunes`, `parseProperties`), so a typo or missing key throws at app start; `AidRules` and the zod schema are NOT linked by the compiler, keep them in sync by hand.
- Cross-checks in `src/schemas.ts` (score weights sum to 1, PTZ tranches/quotités same length, increasing ceilings, rate grid covers `dureeMaxAns`) are covered by `src/schemas.test.ts`; add a rejection test with each new rule.
- Demo data: `src/data/communes.mel.json` and `src/data/biens.demo.json`. Tests reference property/commune ids (`b08`, `roubaix`, …): changing demo data can break `engine.test.ts`.
- `communes.mel.json` has NO `zone`: `Commune.zone` is derived from the official ABC zoning (`zonage.abc.json`) by INSEE code in `parseCommunes(data, zonage)`; a commune missing from the zoning throws. Never hand-code a zone. Official zoning differs from intuition (Lille, Marcq, La Madeleine, Loos, Wasquehal, Lambersart = A; Roubaix, Tourcoing, Wattrelos = B1).
- Market comparison (`src/engine/marche.ts`, DVF medians per commune/type/ancien-vs-VEFA, falls back to agglomeration when n < `marche.minTransactions`) is INFORMATIONAL: it adds alerts and `Evaluation.marche` but never enters `scorePct` or `statut`. It is null for BRS/HLM and thin samples.
- `scripts/` (ETL, Node-only) is not part of the app bundle; `scripts/lib/*` is pure and unit-tested in `scripts/data.test.ts`.
- Local save: `src/storage.ts` (`localStorage` key `immonow.v1`) + `parseSavedState` in `src/schemas.ts`. Loading NEVER throws: invalid/out-of-range/unknown data → `null` → defaults. Bounds mirror the form's `num()` clamps; changing a form bound or `SavedState` means updating the schema too. Bump the key suffix on an incompatible format change.
- Sorting is `sortBy(evals, TriKey)` in `search.ts`; ties break on price then id so order is deterministic; missing values (e.g. no market comparison) always sort last. Favourites/comparison are stored as ids and re-evaluated with `evaluateByIds()` so they stay visible when outside the search criteria.
- The bank loan is sized on the **peak** monthly payment (PTZ repayment overlaps after its deferral), not the first-phase payment. `Evaluation.mensualitePhase1` is what the UI shows; `mensualitePic` is what the 35 % cap is enforced on.
- Financing order is fixed in `evaluate.ts`: apport → subventions → PTZ → Action Logement → Éco-PTZ → bank loan; remaining gap = `financement.manque`.
- Credit fees (dossier + garantie) are financed INSIDE the bank loan (`loanForNeed()` fixed point in `finance.ts`) and added to `coutTotal`; `financement.manque` is the need left after the loan net of fees. Rate slider = `CreditOptions.ajustementTaux` (offset on the grid, bounded by `credit.ajustementTauxMin/Max`), threaded `App` → `runSearch` → `evaluate`/`summarizeBudget`; `creditRate`/`bankPaymentFactor`/`borrowingCapacity` take the offset as last arg.
- `scorePct` comes from `computeScore()` in `src/engine/score.ts` (4 weighted components in `AidRules.score`), it is NOT the funded ratio any more; `statut` (vert/orange/rouge) is computed separately in `evaluate.ts` and the two can differ.

## Code style
- TS strict + `noUnusedLocals/Parameters`; no ESLint/Prettier configured. Double quotes, semicolons, 2-space indent, named exports only (no default exports).
- Domain vocabulary is French (`prix`, `bien`, `aides`, `mensualite`, `statut: "vert"|"orange"|"rouge"`); code comments/UI text in French, identifiers for engine functions in English where generic (`pmt`, `evaluate`).
- Money is plain `number` in euros (no cents, no Decimal); format only through `src/format.ts` (`eur`, `pct`).
- Validate/clamp user numeric input at the form (`num()` in `ProfileForm.tsx`); the engine assumes finite numbers.

## Gotchas
- `.gitignore` cannot be written with the file tools (blocked by the ignore pattern); edit it via shell.
- Windows PowerShell 5.1: `Get-Content`/`Set-Content`/`Add-Content` corrupt accents (ANSI read) or add a BOM (`-Encoding utf8`). Edit source with the file tools; if you must use the shell, use `[IO.File]::ReadAllText/WriteAllText` with `UTF8Encoding($false)`. Console output of accents is garbled even when the file is fine: check with `grep`.
- Aid values are INDICATIVE demo figures (see `avertissement` in the JSON); do not present them as legal advice.
