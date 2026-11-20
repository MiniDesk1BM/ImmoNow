# Project Coding Rules (Non-Obvious Only)
- Do not import React or anything from `src/components` inside `src/engine/`.
- New aid/threshold = `AidRules` (`src/types.ts`) + zod schema (`src/schemas.ts`, strict) + every `src/config/aides.*.json`, plus a rejection test in `src/schemas.test.ts` for any cross-check you add.
- Any change to financing must keep the invariant tested in "jamais au-dessus du taux d'endettement max (pic)": (crédits + mensualitePic) / revenus ≤ 35 % for every demo property.
- Keep ids in `biens.demo.json` / `communes.mel.json` stable: tests look them up by id.
- UI text and alerts are French; use `eur()`/`pct()` from `src/format.ts`.
