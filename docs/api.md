# API v1

All financial values are JSON strings such as `"202.50"`. Demo write requests use `x-demo-role: EDITOR` or `REVIEWER`.

| Method | Route | Role | Purpose |
|---|---|---|---|
| GET/POST | `/api/v1/cases` | Any / Editor | List or create cases |
| GET/PATCH | `/api/v1/cases/{id}` | Any / Editor | Read aggregate (including `snapshotFreshness`) or update header |
| PUT | `/api/v1/cases/{id}/capabilities` | Editor | Replace the ordered capability set |
| PUT | `/api/v1/cases/{id}/step-2` | Editor | Replace costs and income together in one atomic save |
| PUT | `/api/v1/cases/{id}/costs` | Editor | Replace operating cost lines |
| PUT | `/api/v1/cases/{id}/income` | Editor | Replace non-variable income lines |
| PUT | `/api/v1/cases/{id}/capacity` | Editor | Replace capacity plans |
| PUT | `/api/v1/cases/{id}/proposed-rates` | Editor | Replace pricing scenarios |
| POST | `/api/v1/cases/{id}/calculate` | Editor | Validate and append a snapshot |
| POST | `/api/v1/cases/{id}/status` | Editor/Reviewer | Perform a legal workflow transition; submitting or approving requires a current snapshot |
| POST | `/api/v1/cases/{id}/duplicate` | Editor | Copy a case without snapshots |
| GET | `/api/v1/cases/{id}/report.pdf` | Any | Export a selected/latest snapshot |
| GET | `/api/v1/cases/{id}/export.csv` | Any | Export a selected/latest snapshot |
| GET | `/api/health` | Any | Service health response |

Error responses use `{ "error": string, "issues"?: ZodIssue[] }`. Responses carrying case data use `Cache-Control: no-store`.

## Step 2 saves

The wizard sends `{ "costs": [...], "income": [...] }` to `PUT /api/v1/cases/{id}/step-2`. Both arrays are required and may be empty. The server validates both before writing, then replaces changed collections, updates the case step and timestamp when needed, and records the existing audit action for each changed collection in one D1 transactional batch. If any statement fails, all of those changes roll back. The response remains `{ "case": CostingCaseAggregate }`.

The separate `/costs` and `/income` routes remain available for existing clients. Each route now performs its own replacement, case update and audit write atomically. Clients that need the entire Step 2 form saved together should use `/step-2`.

Step 2 accepts at most 200 costs and 100 income records. Inserts are split according to D1's 100-bound-parameter limit and the table's column count: currently at most 12 costs or 16 income records per INSERT. All INSERT chunks, deletions, the case update and audit events stay in **one** transactional `db.batch()` call. A failure in any later chunk rolls back the entire save. Audit events describe the complete submitted collection, rather than individual chunks. See [Step 2 batching verification](testing/step2-batching.md) for evidence and reproduction commands.

## Repeated saves

Case PATCH and the capability, Step 2, legacy cost/income, capacity and proposed-rate save routes compare submitted fields with persisted data. An unchanged save returns the usual `200` aggregate without rewriting the collection or appending another save audit event. If the existing wizard destination step differs, the necessary case step/timestamp update still occurs; a step-only update does not falsely claim a collection changed.

Comparison includes evidence (names, labels, categories, justification, historic utilisation) as well as financial inputs. Decimal strings compare by exact value without rounding; optional empty/null/omitted numeric fields are equivalent, but zero is not absent. Collection transport order is ignored; explicit capability `displayOrder` remains meaningful. Supplied row IDs must match, while omitted optional cost/income/capacity/rate IDs can match by content with duplicate counts preserved. Missing or unknown capability IDs retain their existing new-capability behaviour.

The first explicit empty cost/income save still records its existing audit action, because the wizard uses it to distinguish an intentionally cleared collection from one that has never been filled. Repeated empty saves are then no-ops. Role, schema, capability ownership and read-only checks still run before duplicate-save shortcuts. Explicit calculation and status actions are not deduplicated. See [duplicate-save verification](testing/persistence-deduplication.md), including the concurrency limitations.

## Snapshot freshness

The case aggregate includes `snapshotFreshness`, which compares the newest calculation snapshot with the case's current calculation inputs:

| Value | Meaning |
|---|---|
| `NONE` | The case has never been calculated. |
| `CURRENT` | The newest snapshot was calculated from the inputs the case has now. |
| `STALE` | A calculation-relevant input changed after the newest snapshot was taken. |

Inputs that count: capabilities (name, unit, active, order), cost amount/scope/capability, income amount/type, capacity and forecast utilisation, proposed rates and the user-category mix. Row ids, labels, justifications, historic usage, workflow status and timestamps do not count, so re-saving identical data or restoring an archived case leaves a current snapshot current.

`POST /api/v1/cases/{id}/status` returns `409` when moving a case to `READY_FOR_REVIEW` or `APPROVED` while `snapshotFreshness` is `STALE` (or `NONE`). Recalculate with `POST /api/v1/cases/{id}/calculate` to append a new snapshot; earlier snapshots are never modified.

## Exports

Both `report.pdf` and `export.csv` accept an optional `?snapshot={id}` query parameter and resolve through the same helper (`resolveExportSnapshot`), so they can never disagree about which persisted snapshot they represent:

| Case | Response |
|---|---|
| `snapshot` omitted | The newest snapshot is used. |
| `snapshot` matches an existing snapshot on the case | That snapshot is used, regardless of any edits made to the case since. |
| `snapshot` does not match any snapshot on the case | `404` `{ "error": "Snapshot not found." }` |
| The case has no snapshots yet | `409` `{ "error": "Create a calculation snapshot before exporting..." }` |

Both formats also surface the snapshot's own metadata — creation time, formula version, and the display name of the actor who ran the calculation (mapped from the snapshot's `createdBy` id via `getActorName`) — read from the snapshot itself, not the live case, so a historical export always shows who and when it was actually calculated.
