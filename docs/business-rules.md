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

## Client-approved MVP alignment

The client-approved MVP includes the core five-step costing and pricing workflow, justification and supporting evidence, benchmarking support, structured review information, and PDF/CSV supporting output. Approval of the overall scope does not confirm every detailed implementation rule.

Equipment replacement/recovery, a full digital approval workflow and automated rate communication remain future enhancements unless separately approved. Existing formula and snapshot behaviour remains versioned so later decisions do not rewrite historical results.

## Rules awaiting client validation

- The final allocation driver for shared or platform-level costs. Equal allocation is implemented but is not yet confirmed as client policy.
- Whether recurrent operating support should be allocated equally or by a capability-specific weighting in future versions.
- Whether the 35% external indirect-cost recovery has any exceptions and whether the platform retains any part of it.
- Formal UWA terminology for APFR versus PFRI in reports.
- The benchmark comparison structure, required fields, evidence threshold and retention behaviour. Benchmarking support itself is part of the approved MVP.
- The exact structured-review fields and calculation/audit-history events that the MVP must retain and display. A full digital approval workflow is a future enhancement.
- Whether supporting evidence requires uploaded attachments in addition to notes and links.
- The exact fields, ordering, GST wording and retained audit information required in PDF and CSV outputs. Automated communication is a future enhancement.

Only confirmed decisions that change calculation logic require a new formula version and must not overwrite existing snapshots. Terminology, evidence-attachment and export-wording changes may be updated without a formula-version change unless they affect calculation results.
