# Project Architecture Rules (Non-Obvious Only)
- `src/engine/` must stay framework-free so it can be lifted into an API (Node/FastAPI) unchanged; the UI only calls `runSearch()`.
- Yearly law changes must be data-only (new `aides.<year>.json`), never code changes.
- Financing is sized on peak monthly payment (PTZ deferral ends later), so adding any new deferred loan requires including it in `prets` with `debutAns`/`finAns`.
- Travel-time search, PSLA and real listing connectors are not implemented; they would plug into `search.ts` (filter) and a `Property` normaliser respectively.
