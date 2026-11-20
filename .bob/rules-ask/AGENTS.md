# Project Documentation Rules (Non-Obvious Only)
- `ARCHITECTURE.md` (root) holds the target architecture, data model examples and engine hypotheses; the code is a front-only MVP.
- The "backend logic" is `src/engine/`, running in the browser; there is no server yet.
- Aid figures in `src/config/aides.2025.json` are simplified/indicative, not official barèmes.
- "Biens" are demo data in `src/data/biens.demo.json`, not a real listings API. Zoning (`zonage.abc.json`) and market prices (`marche.dvf.json`) are REAL open data (data.gouv.fr, Licence Ouverte) frozen as a snapshot by `scripts/fetch-open-data.ts`.
- DVF price/m² is a reference point, not an appraisal (one sale = one dwelling, may include a garage; thin samples fall back to the agglomeration).
- User data stays in the browser's `localStorage` (`src/storage.ts`); nothing is sent to a server.
