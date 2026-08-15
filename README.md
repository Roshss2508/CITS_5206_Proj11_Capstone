# Research Infrastructure Costing & Pricing Tool

A deployable MVP for UWA Research Infrastructure custodians to capture annual operating evidence, estimate realistic utilisation, calculate sustainable charge-out rates and retain an auditable pricing snapshot.

## What is implemented

- Durable costing cases with a five-step guided workflow.
- Dynamic management of 1–20 capabilities and hour/day/sample billing units.
- Capability-level and equally allocated platform-level costs.
- UWA and non-UWA recurrent operating support.
- Versioned `RIC_FORMULA_V1` calculation engine using decimal arithmetic.
- Proposed-rate scenarios with UWA/APFR/Commercial user mix.
- Immutable calculation snapshots, audit events and role-based review status.
- PDF and CSV exports generated from the latest snapshot.
- Demo Editor and Reviewer roles; no registration or production SSO.
- D1/SQLite relational persistence for the hosted student demonstration.

Only synthetic or anonymised data may be used in the public demonstration environment.

## Local development

Prerequisite: Node.js 24 LTS.

```bash
npm ci
npm run dev
```

Open `http://localhost:3000`. The local Sites runtime provides a project-local D1 database and creates the required tables on first use.

## Quality commands

```bash
npm run lint
npm run typecheck
npm run test
npm run build
npm run test:e2e
```

`npm run ci` runs the pull-request quality gate except browser E2E. Formula changes must include a Rule ID and a Golden Test.

## Architecture

The application is a modular monolith:

```text
Wizard UI → versioned API → application repository → D1 relational database
                     ↘ RIC calculation engine → immutable snapshot → PDF/CSV
```

Important boundaries:

- UI components never contain authoritative business formulae.
- Every write is validated server-side.
- Monetary API values are decimal strings, never JSON floating-point numbers.
- A snapshot is append-only and remains tied to its formula version.
- Demo authentication is isolated behind role helpers so UWA SSO can replace it later.

See `docs/architecture.md`, `docs/business-rules.md` and `docs/api.md` for implementation details.

## Deployment and data handling

The Sites deployment declares one logical D1 binding named `DB`. No R2 bucket or external secret is required. Before any production or real-data use, UWA must approve hosting, identity, access, retention, backup and recovery requirements.

## Definition of done

A feature is complete when it has server-side validation, a clear empty/error state, keyboard-accessible controls, an owner-reviewed pull request, and automated tests for any calculation rule it changes.
