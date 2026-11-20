# Project Coding Rules (Non-Obvious Only)
- Do not import React or anything from `src/components` inside `src/engine/`.
- New aid/threshold = new field in `AidRules` (`src/types.ts`) + every `src/config/aides.*.json`; JSON is force-cast, so add/adjust a test in `src/engine/engine.test.ts`.
- Any change to financing must keep the invariant tested in "jamais au-dessus du taux d'endettement max (pic)": (crédits + mensualitePic) / revenus ≤ 35 % for every demo property.
- Keep ids in `biens.demo.json` / `communes.mel.json` stable: tests look them up by id.
- UI text and alerts are French; use `eur()`/`pct()` from `src/format.ts`.
