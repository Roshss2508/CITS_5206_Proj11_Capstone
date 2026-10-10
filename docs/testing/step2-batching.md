# Issue #43: Step 2 large-write verification

## Finding

The existing API permits 200 cost rows and 100 income rows. The original repository created one INSERT per collection. Cost rows bind eight values each; income rows bind six. That produced up to 1,600 and 600 bound parameters respectively, exceeding the documented D1 limit of 100 parameters **per statement**, including statements inside a batch.

The first failing sizes are 13 fully populated costs (104 parameters) and 17 income rows (102 parameters), both within the supported API limits. Before the fix, the new repository suite passed its three small/empty cases and failed six larger-save cases. The 13-cost regression failed with `D1 parameter limit exceeded: 104`.

References:

- [D1 limits](https://developers.cloudflare.com/d1/platform/limits/)
- [D1 transactional batch behaviour](https://developers.cloudflare.com/d1/worker-api/d1-database/#batch)
- [Issue #43 and the atomicity requirements](https://github.com/Roshss2508/CITS_5206_Proj11_Capstone/issues/43)
- [Original atomic Step 2 persistence, PR #51](https://github.com/Roshss2508/CITS_5206_Proj11_Capstone/pull/51)

## Implementation

`db/batching.ts` derives each chunk's row count from `floor(100 / columnCount)`. The repository obtains the column count from the Drizzle table schema, so adding a column automatically reduces the number of rows per INSERT.

| Collection | API maximum | Columns per row | Rows per INSERT | INSERTs at maximum |
|---|---:|---:|---:|---:|
| Costs | 200 | 8 | 12 | 17 |
| Income | 100 | 6 | 16 | 7 |

Each INSERT binds at most 96 parameters with the current schema. All chunks are appended to the existing single `db.batch()` alongside the deletes, case update and audit inserts. The largest combined save contains 29 statements in that transaction. No intermediate chunk is committed independently. The combined and legacy endpoints share this implementation.

API limits, response shapes, financial formulas, schema and the two existing collection-level audit actions are unchanged. Empty arrays still delete the corresponding collection; omitted collections in the legacy paths remain untouched.

## Automated evidence

`tests/step2-batching.test.ts` executes the repository's actual Drizzle SQL against an in-memory SQLite database with a test adapter that enforces the documented 100-parameter limit. This limit is checked independently of the implementation constant, because a local D1 emulator may permit more bound parameters than hosted D1. The adapter also executes each repository batch as one SQLite transaction.

The eleven repository cases cover:

- Empty and single-row collections.
- The last single-INSERT sizes: 12 costs and 16 income rows.
- Crossing both boundaries: 13 costs and 17 income rows.
- Crossing each boundary independently with the other collection empty.
- The supported maxima: 200 costs and 100 income rows, comparing every stored field.
- A duplicate primary key in the final cost or income chunk; both collections and the complete case aggregate must roll back.
- Maximum-size saves through the separate cost and income repository paths.
- Platform costs with null capability references and generated unique row IDs.

`tests/e2e/step2-atomic.spec.ts` additionally exercises the HTTP routes and local D1 runtime. Its added cases save and clear maximum-size collections across 20 capabilities, force late-chunk failures in each collection, and verify maximum-size legacy saves and rollback. Failure assertions compare the entire persisted aggregate, including case step, timestamp and audit history. Existing cases continue to cover ordinary small saves, empty collections and invalid input.

Run:

```bash
npm run test -- tests/step2-batching.test.ts
npm run test:e2e -- tests/e2e/step2-atomic.spec.ts --workers=1
npm run ci
npm run test:e2e -- --workers=1
```

These tests use synthetic data only. The HTTP integration suite uses local D1; no hosted financial data is modified. Hosted CI results are linked in the PR.

## Scope

This change covers the combined Step 2 save and the separate cost/income save endpoints. It does not make a general scalability claim for unrelated repository paths, change duplicate-save/audit semantics (#44), or replace final integrated release checks (#69).
