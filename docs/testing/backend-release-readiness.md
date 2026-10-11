# Issue #69: Final backend and calculation verification

## Scope and baseline

Verified on 11 October 2026 with Node.js 24.12.0 and npm 11.6.2. The branch starts from integrated `main` commit `6bbafbf`, which includes [atomic Step 2 saves, PR #51](https://github.com/Roshss2508/CITS_5206_Proj11_Capstone/pull/51), [large-write batching, PR #70 / #43](https://github.com/Roshss2508/CITS_5206_Proj11_Capstone/pull/70), and [defensive duplicate-save protection, PR #71 / #44](https://github.com/Roshss2508/CITS_5206_Proj11_Capstone/pull/71). Both #43 and #44 are closed after merge. This is scoped backend evidence for [Issue #69](https://github.com/Roshss2508/CITS_5206_Proj11_Capstone/issues/69), not client acceptance, a hosted deployment check or a production/security certification.

Only synthetic fixtures and local databases were used. No original client workbook or financial records were uploaded. Authoritative formulas, `RIC_FORMULA_V1`, schemas, API shapes, role policy and genuine-change audit wording are unchanged.

## Release defects found and fixed

Reviewing the complete 1–20 capability journey found the same parameter-limit problem outside Step 2:

| Path | Old single INSERT | First failing full-row size | Corrected chunk size |
|---|---:|---:|---:|
| Capacity | 9 binds per row | 12 rows / 108 binds | 11 rows / 99 binds |
| Proposed rates | 10 binds per row | 11 rows / 110 binds | 10 rows / 100 binds |
| Case duplication | Unchunked capabilities, costs, income and plans | 20 capabilities alone require 120 binds | Schema-derived chunks for every copied collection |

Previously capacity/rate replacement performed DELETE, INSERT, metadata and audit as separate writes. A late failure could leave changed data without its audit; failed duplication could leave a partial new case. The new regression suite initially had **12 failures**, while the existing **141 tests passed**. Small capacity/rate cases failed the new transaction assertion; larger cases failed the independent bind guard; injected late failures exposed incomplete rollback. The large-copy test initially stopped at its capacity setup; inspection also identified the unchunked copy inserts.

Capacity and proposed-rate changes now each use one transactional D1 batch containing deletion, parameter-safe INSERT chunks, step/timestamp and the original audit action. Existing no-op shortcuts and validation execute before writing. No-op requests still perform no collection writes or new save audit.

Duplication now commits the new case header, actor insert-if-needed, all copied collections and audit markers in one batch. IDs are regenerated and capability references remapped; snapshots and prior audit history are not copied, exactly as before. Explicit empty-save markers are retained. The response uses the exact committed rows without rereading nine tables. At supported maxima this requires **42 SQL statements including source reads**, below the warmed Free-plan limit of 50; the test counts each statement inside the batch separately. Schema bootstrap is deliberately excluded (see limits below).

References: [D1 limits](https://developers.cloudflare.com/d1/platform/limits/) and [transactional batch semantics](https://developers.cloudflare.com/d1/worker-api/d1-database/#batch).

## Calculation evidence

The existing approved-reference test remains the calculation oracle: [calculation tests](../../tests/calculation.test.ts), [Business Rule Catalogue](../business-rules.md), and [Business Rule Analysis](../business-rule-analysis.md), particularly BR-07–BR-11. This check does not independently approve unresolved policy details.

The added HTTP test persists the reference through the real APIs before calculating, rather than passing a fixture directly to the engine:

| Input / output | Exact value |
|---|---|
| Direct maintenance + shared staffing | `100000` + `50000` |
| UWA / non-UWA recurring support | `20000` / `30000` |
| Maximum capacity × forecast percentage | `2000` × `50%` = `1000.000000` units |
| UWA / APFR / Commercial minimum rates | `100.00` / `162.00` / `202.50` |
| APFR / Commercial per-unit overhead | `42.00` / `52.50` |
| User mix | `60%` / `25%` / `15%` |
| Gross user revenue | `130875.00` |
| University overhead | `18375.00` |
| Net platform recovery | `112500.00` |
| Operating balance | `12500.00` |

Snapshot JSON must contain exactly the persisted inputs and returned calculation output, with the same formula version, actor and time. Changing only the proposed UWA rate to `120` keeps minimum rates and external overhead unchanged, increases gross/net recovery by `12000.00`, and increases balance to `24500.00`. Recalculation appends a snapshot without modifying the previous one. Existing unit tests cover support independence, GST-exclusive outputs, HALF_UP rounding, allocation and invalid denominators/shares.

## Acceptance-criteria evidence

| Issue #69 criterion | Verification |
|---|---|
| Authoritative calculation tests and sustainable-rate reference | `tests/calculation.test.ts`; persisted Golden Case in `tests/e2e/backend-release-readiness.spec.ts` |
| Step 2 atomic and data-safe | `tests/step2-batching.test.ts`; `tests/e2e/step2-atomic.spec.ts`, including failures after earlier chunks succeed |
| Large-write / parameter limits | Independent 100-bind SQLite adapter; 200 costs / 100 income; 10, 11, 12 and 20 capacity/rate rows; maximum-size copy |
| No silently lost, duplicated or partially committed rows | Full-field/row-count comparison, remapped references, late INSERT/audit failure rollback and original-case equality |
| Genuine changes persist and produce accurate audits | `tests/persistence-deduplication.test.ts`; changed-evidence and pricing HTTP checks; first-empty-save markers |
| Unchanged saves remain safe | Comparison/repository suites plus `tests/e2e/persistence-deduplication.spec.ts`; capacity/rate replay after the new batch changes |
| Backend validation / important errors | HTTP `400` for invalid amounts, zero/over-100 utilisation, invalid mix, collection bounds and foreign/unknown capability IDs; `403` demo-role rejection; `404` missing case; `409` missing/stale snapshots and read-only cases; existing `500` constraint-failure rollback |
| Latest integrated-version regression | Base `6bbafbf` plus this PR; full quality and Chrome/Edge suites below. Re-run after any later integration changes |
| Demonstration blockers / limits | Identified functional defects fixed; release conclusion is limited to the tested synthetic-data workflow. Security, hosted limits, concurrency and client-dependent gaps remain explicitly qualified below |

## Reproduction and results

```bash
npm ci
npm run test -- tests/calculation.test.ts tests/validation.test.ts tests/step2-batching.test.ts tests/persistenceComparison.test.ts tests/persistence-deduplication.test.ts tests/backend-release-readiness.test.ts
npm run test:e2e -- tests/e2e/backend-release-readiness.spec.ts --workers=1
npm run ci
npm run test:e2e -- --workers=1
git diff --check
npm audit
```

The repository tests execute real Drizzle SQL against SQLite with foreign keys and an independent 100-bind limit. Forced late INSERT/audit failures test rollback, including metadata and audit history. The HTTP tests run the real application and local D1; the emulator does not establish hosted limits on its own. Chrome/Edge runs include the existing UI, role, workflow, freshness, PDF/CSV and audit regressions as well as the added API checks. Tests create their own synthetic cases and archive HTTP fixtures during teardown.

Local results on 11 October 2026:

| Command | Result |
|---|---|
| `npm ci` | Clean lockfile install succeeded; dependency audit findings remain below |
| `npm run ci` | Lint, type checking, **157 tests across 12 files**, and production build passed |
| Focused readiness HTTP suite | **10 passed** across Chrome and Edge |
| Full `npm run test:e2e -- --workers=1` | **112 passed** across Chrome and Edge; local retries disabled |
| `git diff --check` | Passed |

GitHub CI is independently recorded on the associated PR. A green local run does not replace non-author review or the required GitHub check. These results apply to this branch, not unmerged teammates' branches or a later `main`.

## Remaining limits and release conditions

- **Hosting and cold bootstrap:** the 42-statement maximum-copy check is for an initialised database. `ensureDatabase()` currently runs 21 schema/seed statements once per worker isolate. A cold maximum-size copy can therefore exceed a Free-plan 50-query invocation allowance. Verify the actual hosting plan and cold-start behaviour before demonstrating maximum-size cases on a hosted deployment; deployment-time migrations / removal of request-time bootstrap need separate work. Local D1 tests are not evidence of hosted quota, concurrency or throughput capacity. This PR does not change deployment or schema bootstrap.
- **Dependency/security follow-up:** `npm audit` on 11 October reported **26 vulnerable dependency entries (18 high, 8 moderate, 0 critical)** for the existing lockfile. Examples include `react-server-dom-webpack` 19.2.6 ([server-function DoS advisory](https://github.com/advisories/GHSA-wx67-qw84-cm4g)) and the Vite 8.0.13 development-server dependency chain. Dependency classification as dev-only does not prove that bundled server code is unaffected. A separate compatibility-tested dependency/security review is required before public/production release; no blanket `npm audit fix --force`, version migration or lockfile rewrite was performed here. Audit counts are time-sensitive and must be rerun at release.
- **Demo access only:** role headers are a demonstration adapter, not trusted authentication or tenant isolation. Real UWA financial data, production SSO, hosting, retention and recovery approval remain outside this sign-off.
- **Concurrent editing:** unchanged-save protection is sequential persisted-content comparison, not cross-worker exactly-once delivery, revision conflict detection or a lock. Simultaneous requests remain last-write-wins; snapshot/source reads are not a multi-table read transaction.
- **Transactional scope:** this PR makes changed capacity/rate replacements and duplication atomic, alongside previously atomic Step 2 saves. Case creation, capability-set edits, snapshot creation and status transitions still consist of multiple writes; this is not a claim that every repository operation survives every injected database failure atomically.
- **Error contract:** existing constraint failures return `500`; some role/workflow errors are plain-text `Response` objects rather than the JSON validation envelope. Malformed JSON and invalid transition error classification/sanitisation still need hardening. No new HTTP status contract was introduced.
- **Policy and client acceptance:** allocation driver, APFR/PFRI wording, uplift exceptions and final export/review details remain governed by the Business Rule Analysis. Benchmarking completeness and client UAT/handover are separate team tasks. No policy was inferred from automated success.

The functional evidence supports review of this integrated synthetic-data demonstration candidate. It does **not** certify an unrestricted production deployment or close the team’s broader MVP acceptance, UI, deployment and security work.
