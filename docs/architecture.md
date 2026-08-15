# Architecture Decision Record: Modular Monolith

## Decision

The MVP is one vinext/Next-compatible TypeScript application deployed as a Cloudflare Worker. It contains the Web Wizard, route-handler API, repository, D1 relational database adapter, calculation engine and export adapters.

This replaces the planned external PostgreSQL/Prisma deployment with D1/Drizzle for the course demonstration. The relational model, decimal-string API and repository boundary preserve a practical later migration path to PostgreSQL without changing the Wizard or calculation engine.

## Module boundaries

- `components/`: user workflow and presentation only.
- `app/api/v1/`: HTTP validation, role checks and response mapping.
- `src/modules/calculation/`: pure, versioned business rules with no UI or database dependency.
- `src/modules/repository.ts`: all durable state and audit writes.
- `db/schema.ts`: relational schema and indexes.

## Data flow

1. The Editor completes a Wizard step.
2. The client debounces an autosave and sends decimal strings to `/api/v1`.
3. Zod validates the complete step and the repository replaces its owned collection.
4. Calculate loads the full aggregate, runs `RIC_FORMULA_V1`, and appends a snapshot.
5. PDF and CSV exports read a selected immutable snapshot.
6. Reviewer actions are checked server-side and appended to the audit history.

## Security boundary

The current role selector is a deliberate demo adapter, not production authentication. Data is synthetic. A production adapter must obtain a trusted identity from Microsoft Entra ID/UWA SSO and enforce case ownership or organisational membership before repository access.

## Operational model

- `/api/health` supplies a smoke-test target.
- D1 tables and indexes are idempotently initialised for local previews; generated migrations are committed for hosted deployment.
- GitHub Actions runs lint, typecheck, unit tests and the deployment build.
- Audit records contain action summaries, never complete financial request bodies.
