# Project Coding Rules (Non-Obvious Only)
- Do not import React or anything from `src/components` inside `src/engine/`.
- New aid/threshold = `AidRules` (`src/types.ts`) + zod schema (`src/schemas.ts`, strict) + every `src/config/aides.*.json`, plus a rejection test in `src/schemas.test.ts` for any cross-check you add.
- Any change to financing must keep the invariant tested in "jamais au-dessus du taux d'endettement max (pic)": (crédits + mensualitePic) / revenus ≤ 35 % for every demo property.
- Keep ids in `biens.demo.json` / `communes.mel.json` stable: tests look them up by id.
- UI text and alerts are French; use `eur()`/`pct()` from `src/format.ts`.
- Never write a commune `zone` by hand and never edit `zonage.abc.json`/`marche.dvf.json` manually: run `npm run data:fetch`. The market comparison must stay out of `scorePct`/`statut`.
- Anything persisted must go through `src/storage.ts` + `parseSavedState` (zod, bounded, never throws). Do not read `localStorage` elsewhere or store identifiers/PII beyond the form state.
- Adding a `TriKey` = update the union in `types.ts`, `TRI_LABELS` and `CLES` in `search.ts`, and the zod `tri` enum in `schemas.ts` (the compiler does not link the last one).
- Do not edit files with PowerShell `Get-Content`/`Set-Content` (mangles UTF-8); use the file tools.
