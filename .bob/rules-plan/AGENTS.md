# Project Architecture Rules (Non-Obvious Only)
- `src/engine/` must stay framework-free so it can be lifted into an API (Node/FastAPI) unchanged; the UI only calls `runSearch()`.
- Yearly law changes must be data-only (new `aides.<year>.json`), never code changes.
- Financing is sized on peak monthly payment (PTZ deferral ends later), so adding any new deferred loan requires including it in `prets` with `debutAns`/`finAns`.
- Travel-time search, PSLA and real listing connectors are not implemented; they would plug into `search.ts` (filter) and a `Property` normaliser respectively.
- The open-data hosts send no CORS headers, so data must be fetched server-side/at build time (`npm run data:fetch`) and shipped as JSON; calling them from the browser is not an option. A production version would run this ETL on a schedule.
- Zone ABC is the join key between `communes` (INSEE) and PTZ/BRS ceilings: changing the zoning source changes eligibility results.
- Persistence is local-only by design (no account, no server). Moving it server-side means a new privacy/security review, not just a new `storage.ts` backend.
