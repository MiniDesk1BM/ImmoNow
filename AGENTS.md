# AGENTS.md

This file provides guidance to agents when working with code in this repository.

## Commands
- `npm run dev` (bound to 127.0.0.1:5173; never bind 0.0.0.0), `npm run build` (runs `tsc --noEmit` first), `npm run typecheck`
- `npm test` = `vitest run`; only `src/**/*.test.ts` are collected (see `vite.config.ts`), node environment (no component tests)
- Single test: `npx vitest run -t "PTZ refusé si non primo-accédant"` or `npx vitest run src/engine/engine.test.ts -t "<name>"`

## Architecture (non-obvious)
- `src/engine/` is pure TS with no React imports; keep it that way (it is meant to move to a backend). Entry point: `runSearch()` in `src/engine/index.ts`.
- All aid rules/barèmes live in `src/config/aides.<year>.json`, typed by `AidRules` in `src/types.ts`. Never hardcode thresholds/rates in code; add a field to `AidRules` + the JSON, then switch the year in `src/config/index.ts` (JSON is cast with `as unknown as AidRules`, so the compiler will NOT catch a JSON/type mismatch; add a test).
- Demo data: `src/data/communes.mel.json` (Métropole Européenne de Lille, with PTZ zone) and `src/data/biens.demo.json`. Tests reference property/commune ids (`b08`, `roubaix`, …): changing demo data can break `engine.test.ts`.
- The bank loan is sized on the **peak** monthly payment (PTZ repayment overlaps after its deferral), not the first-phase payment. `Evaluation.mensualitePhase1` is what the UI shows; `mensualitePic` is what the 35 % cap is enforced on.
- Financing order is fixed in `evaluate.ts`: apport → subventions → PTZ → Action Logement → Éco-PTZ → bank loan; remaining gap = `financement.manque`.

## Code style
- TS strict + `noUnusedLocals/Parameters`; no ESLint/Prettier configured. Double quotes, semicolons, 2-space indent, named exports only (no default exports).
- Domain vocabulary is French (`prix`, `bien`, `aides`, `mensualite`, `statut: "vert"|"orange"|"rouge"`); code comments/UI text in French, identifiers for engine functions in English where generic (`pmt`, `evaluate`).
- Money is plain `number` in euros (no cents, no Decimal); format only through `src/format.ts` (`eur`, `pct`).
- Validate/clamp user numeric input at the form (`num()` in `ProfileForm.tsx`); the engine assumes finite numbers.

## Gotchas
- `.gitignore` cannot be written with the file tools (blocked by the ignore pattern); edit it via shell.
- Windows/PowerShell: `Set-Content` without `-Encoding utf8` mangles accents in files; verify French strings after shell edits.
- Aid values are INDICATIVE demo figures (see `avertissement` in the JSON); do not present them as legal advice.
