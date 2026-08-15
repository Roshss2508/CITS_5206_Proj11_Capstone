# API v1

All financial values are JSON strings such as `"202.50"`. Demo write requests use `x-demo-role: EDITOR` or `REVIEWER`.

| Method | Route | Role | Purpose |
|---|---|---|---|
| GET/POST | `/api/v1/cases` | Any / Editor | List or create cases |
| GET/PATCH | `/api/v1/cases/{id}` | Any / Editor | Read aggregate or update header |
| PUT | `/api/v1/cases/{id}/capabilities` | Editor | Replace the ordered capability set |
| PUT | `/api/v1/cases/{id}/costs` | Editor | Replace operating cost lines |
| PUT | `/api/v1/cases/{id}/income` | Editor | Replace non-variable income lines |
| PUT | `/api/v1/cases/{id}/capacity` | Editor | Replace capacity plans |
| PUT | `/api/v1/cases/{id}/proposed-rates` | Editor | Replace pricing scenarios |
| POST | `/api/v1/cases/{id}/calculate` | Editor | Validate and append a snapshot |
| POST | `/api/v1/cases/{id}/status` | Editor/Reviewer | Perform a legal workflow transition |
| POST | `/api/v1/cases/{id}/duplicate` | Editor | Copy a case without snapshots |
| GET | `/api/v1/cases/{id}/report.pdf` | Any | Export a selected/latest snapshot |
| GET | `/api/v1/cases/{id}/export.csv` | Any | Export the latest calculated rates |
| GET | `/api/health` | Any | Service health response |

Error responses use `{ "error": string, "issues"?: ZodIssue[] }`. Responses carrying case data use `Cache-Control: no-store`.
