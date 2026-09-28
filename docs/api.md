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
| GET | `/api/v1/cases/{id}/export.csv` | Any | Export the latest calculated rates |
| GET | `/api/health` | Any | Service health response |

Error responses use `{ "error": string, "issues"?: ZodIssue[] }`. Responses carrying case data use `Cache-Control: no-store`.

## Step 2 saves

The wizard sends `{ "costs": [...], "income": [...] }` to `PUT /api/v1/cases/{id}/step-2`. Both arrays are required and may be empty. The server validates both before writing, then replaces the two collections, updates the case step and timestamp, and records the existing cost and income audit actions in one D1 transactional batch. If any statement fails, all of those changes roll back. The response remains `{ "case": CostingCaseAggregate }`.

The separate `/costs` and `/income` routes remain available for existing clients. Each route now performs its own replacement, case update and audit write atomically. Clients that need the entire Step 2 form saved together should use `/step-2`.

## Snapshot freshness

The case aggregate includes `snapshotFreshness`, which compares the newest calculation snapshot with the case's current calculation inputs:

| Value | Meaning |
|---|---|
| `NONE` | The case has never been calculated. |
| `CURRENT` | The newest snapshot was calculated from the inputs the case has now. |
| `STALE` | A calculation-relevant input changed after the newest snapshot was taken. |

Inputs that count: capabilities (name, unit, active, order), cost amount/scope/capability, income amount/type, capacity and forecast utilisation, proposed rates and the user-category mix. Row ids, labels, justifications, historic usage, workflow status and timestamps do not count, so re-saving identical data or restoring an archived case leaves a current snapshot current.

`POST /api/v1/cases/{id}/status` returns `409` when moving a case to `READY_FOR_REVIEW` or `APPROVED` while `snapshotFreshness` is `STALE` (or `NONE`). Recalculate with `POST /api/v1/cases/{id}/calculate` to append a new snapshot; earlier snapshots are never modified.
