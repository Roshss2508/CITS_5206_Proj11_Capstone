# Business Rule Catalogue

## RIC_FORMULA_V1

| Rule ID | Rule | Automated evidence |
|---|---|---|
| RATE-UWA-001 | `(cost − UWA support − non-UWA support) ÷ forecast units`, floored at zero. | Golden test |
| RATE-APFR-001 | `((cost − non-UWA support) ÷ forecast units) × 1.35`, floored at zero before the multiplier. | Golden test |
| RATE-COM-001 | `(cost ÷ forecast units) × 1.35`; UWA support cannot reduce this rate. | Golden + independence test |
| CAPACITY-001 | `forecast units = maximum realistic capacity × forecast utilisation percentage`. | Zero-unit validation test |
| COST-ALLOC-001 | Platform costs are split equally across active capabilities; direct costs stay with their capability. | Multi-capability test |
| INCOME-ALLOC-001 | UWA and non-UWA recurrent support are split equally across active capabilities. | Golden test |
| SHARE-001 | UWA, APFR and Commercial forecast user shares must total exactly 100%. | Validation test |
| OVERHEAD-001 | External proposed-rate revenue exposes the 35/135 overhead portion separately from net platform recovery. | Calculation result |
| GST-001 | All calculations are GST exclusive; GST may be shown separately but never supports facility operations. | Report wording |
| SNAPSHOT-001 | Calculation snapshots are append-only and retain input, output, actor, time and formula version. | Repository/API design |

## Precision

SQLite stores financial values as decimal strings. `decimal.js` performs every authoritative calculation. Intermediate results are not rounded; currency presentation is rounded half-up to two decimal places and quantities to six decimal places.

## Rules awaiting client validation

- Whether recurrent operating support should be allocated equally or by a capability-specific weighting in future versions.
- Whether the platform retains any part of the 35% external indirect-cost recovery.
- Formal UWA terminology for APFR versus PFRI in reports.

Changes to these decisions require a new formula version and must never overwrite existing snapshots.
