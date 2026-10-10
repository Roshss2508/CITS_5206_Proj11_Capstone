# Issue #44: Defensive duplicate-save verification

## Findings after the frontend fix

Reviewed the save lifecycle merged in #47 / PR #64: successful saves reset dirty state, but manual Save & Continue still calls the API, and older/other clients can replay unchanged requests. The repository still updated case timestamps, rewrote collections and appended save audit records for each such request. The frontend fix therefore does not remove the need for backend defensive comparison.

The first 14 repository regression cases were run before changing backend persistence: **12 failed, 2 passed**. Failures covered unchanged case PATCH, capabilities, Step 2 (including 200 costs + 100 income records), capacity, proposed rates, legacy endpoints, first-empty-save replay and unnecessary audits on a step-only save. The two existing behaviours already passing were explicit row-identity changes/constraint rollback and read-only rejection.

This branch has been rebased onto latest `main` at `19d57e1`, after #43 / PR #70 was merged. Its diff contains only #44 changes and preserves parameter-safe INSERT chunking and the single atomic Step 2 batch from #70.

## Comparison and persistence policy

| Path | Fields compared | Unchanged save |
|---|---|---|
| Case PATCH | Each supplied platform name, pricing period and current step | No UPDATE, timestamp change or CASE_UPDATED event |
| Capabilities | ID, name, unit, active, displayOrder | No capability writes or CAPABILITIES_SAVED event |
| Costs | ID when supplied, capability, category, scope, label, amount, justification | No delete/insert or COSTS_SAVED event |
| Income | ID when supplied, source name/type, amount, justification | No delete/insert or INCOME_SAVED event |
| Capacity | ID when supplied, capability, maximum, forecast percentage, all three historic values, justification | No delete/insert or CAPACITY_SAVED event |
| Proposed rates | ID when supplied, capability, all three optional rates, all three user shares, justification | No delete/insert or PROPOSED_RATES_SAVED event |

The helper deliberately does **not** reuse the calculation fingerprint: that fingerprint omits evidence which must still be persisted and audited. Decimal comparison uses decimal.js without rounding or JavaScript-number conversion. Numeric formatting does not create a material change; zero is distinct from an absent optional value. Text evidence remains significant.

Collections are compared as multisets, ignoring JSON property/transport ordering while preserving duplicate multiplicity. Supplied IDs must match the same stored row; unknown or duplicate supplied IDs cannot bypass persistence/constraints. Omitted optional cost/income/capacity/rate IDs can match existing content and keep stored IDs stable. Capability IDs retain the old semantics because other tables reference them: omitted/unknown IDs create replacement capabilities rather than silently matching by content. New or changed capability saves avoid updating retained capability rows whose fields are unchanged; removal cascades are preserved.

### Important exceptions and invariants

- First explicit empty costs/income saves still create the original save marker once. The wizard and case duplication use these markers to avoid reintroducing synthetic defaults. Subsequent empty saves skip writes; clearing a populated list remains a real, audited change.
- Wizard saves retain their existing destination steps (2/3/4/5). If only that step needs changing, only case metadata is written and no collection-change audit is invented. A replay at the same destination step leaves `updatedAt` unchanged.
- Changed Step 2 collections, case metadata and their audit events remain in one `db.batch()`. An unchanged collection is not rewritten or audited. A late INSERT failure still rolls back everything written by that save, including when the other collection is unchanged.
- API response shapes/statuses, server validation, role checks, capability ownership and read-only rejection stay intact. Identical invalid/unauthorised requests are not accepted as no-ops.
- Actual calculation requests still append immutable snapshots; legal status changes still keep their audit evidence. Neither is a generic autosave to deduplicate.
- No schema, costing formula, approved business rule, frontend dirty-state implementation or audit wording for genuine changes is changed.

## Automated evidence

`tests/persistence-deduplication.test.ts` executes the actual repository Drizzle SQL against SQLite, independently enforcing D1's 100-parameter limit. It records writes and transaction batches, proving no SQL writes for sequential identical saves and correct writes/audits for actual changes. Coverage includes maximum collections, partial Step 2 changes, legacy paths, first/cleared empty lists, necessary step updates, explicit and omitted IDs, capability removal, all capacity/rate evidence fields, ownership validation and rollback after a late failure.

`tests/persistenceComparison.test.ts` covers multiset duplicates, mixed supplied/omitted IDs, identity changes, numeric formatting, exact large decimal values and absent-versus-zero fields.

`tests/e2e/persistence-deduplication.spec.ts` exercises real HTTP routes and local D1 in Chrome and Edge: all save routes and compatible response aggregates, maximum-size replays, changed evidence, empty-list page reload, invalid/reviewer/read-only rejection, snapshot freshness and stale-submission rejection. Existing `step2-atomic.spec.ts` remains a required regression suite for #32/#43.

Reproduce:

```bash
npm run test -- tests/persistenceComparison.test.ts tests/persistence-deduplication.test.ts tests/step2-batching.test.ts
npm run test:e2e -- tests/e2e/persistence-deduplication.spec.ts tests/e2e/step2-atomic.spec.ts --workers=1
npm run ci
npm run test:e2e -- --workers=1
```

All data are synthetic and the HTTP integration tests use local D1, not hosted client data.

Local verification on 10 October 2026 (revalidated after rebasing onto merged PR #70):

- `npm run ci`: lint, TypeScript checking, **139 tests across 10 files**, and production build passed.
- Focused duplicate-save/atomic HTTP suite: **26 passed** across Chrome and Edge.
- Full browser regression: **102 passed** across Chrome and Edge.
- `git diff --check`: passed.

These are local results; GitHub CI is reported separately on the associated #44 PR. The connector could not post the pre-implementation findings to Issue #44 (403), so the reproduced findings and completion evidence are retained here and summarised in the PR.

## Limits

This is persisted-content comparison for sequential replays, not an exactly-once/idempotency-key protocol or a concurrency lock. Simultaneous requests that read the same prior state may both decide to write, as in the existing application; concurrent editing remains last-write-wins. Guaranteeing deduplication across racing workers would need a separately designed database-level revision/idempotency mechanism and conflict/retry contract. No in-memory lock is used or presented as a cross-worker guarantee.

Read queries still occur to validate and compare the submission and return the current aggregate; the optimisation reduces writes and misleading audits, not all API traffic. Initial database bootstrapping is unchanged. Existing non-Step-2 replacement saves retain their previous transactional/scalability limitations, which this issue does not silently broaden into a database redesign.
