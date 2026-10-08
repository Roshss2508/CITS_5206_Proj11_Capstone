# Business Rule Analysis

## Source Material Reviewed

| ID | Source | Use in this catalogue |
|---|---|---|
| S1 | `01_CONTEXT-Costing & Pricing Research Infrastructure.docx` | Primary client methodology for research infrastructure costing, rate calculation, GST treatment, benchmarking, approval and communication. |
| S2 | `02_TEMPLATE-RIC Cost Calculator.xlsx` | Existing RIC Cost Calculator workbook used to verify spreadsheet structure, formulas, capability allocation, proposed rates and recovery comparison. |
| S3 | `03_EXAMPLE-Project Costing Template.docx` | Comparable project costing example. It supports guided input, editable assumptions, output review and export patterns, but it is not the source for RIC platform formulas. |
| S4 | `04_EXAMPLE-UniSuper Calculator.docx` | Comparable calculator user experience reference. It supports the guided calculator pattern, adjustable inputs, forecast output and export pattern. |
| S5 | Current application, repository and merged GitHub pull requests | Implementation and test evidence, including PRs #1, #14, #16, #17, #21, #23, #34, #36-#38, #40, #49-#53 and #60. It is not treated as client policy by itself. |
| S6 | GitHub Issues #45 and #46 | Issue #45 tracks alignment with the client-approved MVP scope. Issue #46 tracks acceptance-criteria verification and gap analysis. |
| S8 | `Proposed MVP client agreement - ES agreed.docx` | Client-approved MVP scope, acceptance criteria, future enhancements and implementation details that still require clarification. |

---

## Business Rule Catalogue

### BR-01 — Operating Costs

**Classification:** Confirmed from client material

The calculator must capture the annual operating costs required to run a research infrastructure capability.

Confirmed cost categories include:

- maintenance or service contracts;
- personnel needed for operation, training, invoicing and technical support;
- non-project consumables or reagents;
- software;
- data storage or computing;
- utilities; and
- equipment-specific compliance.

**Source:** S1.

**Current implementation note:**  
The workbook groups operating costs into direct costs, directly allocated costs, indirect costs, income, indirect costs covered outside the business unit and minimum recovery totals.

**Clarification:**  
Confirm whether every S1 operating cost category needs a dedicated field in the application, or whether some categories can be grouped.

---

### BR-02 — Cost Focus and Replacement Context

**Classification:** Future enhancement / outside approved MVP

The approved agreement treats equipment replacement and recovery as a future enhancement unless the client later confirms that it is essential.

**Source:** S8.

**Current implementation note:**  
The current application can record a replacement reserve as an operating-cost category, but it does not calculate replacement timing or a recovery period.

**Clarification:**  
If this enhancement is brought into scope later, confirm the replacement value, recovery period and rate-calculation treatment.

---

### BR-03 — Non-Variable Operating Income and Support

**Classification:** Confirmed from client material

Non-variable operating income or support must be identified separately from user fees.

Confirmed examples include:

- university in-kind support;
- GP funding;
- NCRIS funding; and
- other recurrent government support.

User fees are not included in this category.

**Source:** S1.

**Current implementation note:**  
The workbook contains income rows and separate minimum recovery rows for UWA, APFR/PFRI and commercial scenarios.

**Clarification:**  
Confirm the exact mapping between Non-Variable Operating Income and Non-UWA Operating Support in the application data model.

---

### BR-04 — Billable Units

**Classification:** Confirmed from client material

Each capability must use a defined billable unit consistently across capacity, utilisation and pricing.

The methodology gives hours, days and samples as examples.

**Source:** S1.

**Current implementation note:**  
The workbook mostly demonstrates hour-based capacity and rate calculation, while the methodology allows other units.

**Clarification:**  
Confirm the allowed unit list and whether non-hour units need conversion rules.

---

### BR-05 — Available Capacity

**Classification:** Confirmed from client material

Available capacity must reflect realistic billable availability rather than the maximum theoretical calendar time.

Capacity should account for:

- maintenance;
- staff availability;
- downtime;
- compliance requirements;
- setup and pack-down time; and
- planned outages.

**Source:** S1.

**Current implementation note:**  
The workbook records UWA standard year assumptions of 230 days and 1,725 hours, and machine-year assumptions of 251 days and 1,882.5 hours.

**Clarification:**  
Confirm whether these year assumptions are fixed defaults, editable defaults or examples only.

---

### BR-06 — Historical and Forecast Utilisation

**Classification:** Confirmed from client material

Forecast annual utilisation should be informed by historical usage and expected changes.

It is a major assumption because it directly determines the denominator in the charge-out rate formulas.

**Source:** S1.

**Current implementation note:**  
The workbook includes background sheets for average usage and user group type, and the calculator sheet applies utilisation percentages to capacity in rate and recovery formulas.

**Clarification:**  
Confirm the required historical period and the forecast horizon for the final application.

---

### BR-07 — UWA Researcher Charge-Out Rate

**Classification:** Confirmed from client material

The UWA charge-out rate is calculated as:

`total operating costs − non-variable operating income ÷ annual utilisation`

More precisely:

`(total operating costs − non-variable operating income) ÷ annual utilisation`

**Source:** S1, S2.

**Current implementation note:**  
The workbook confirms the same structure in the rate calculation sheet, for example `minimum recovery / (capacity x utilisation)` for the UWA row.

**Clarification:**  
Confirm rounding and display precision for calculated rates.

---

### BR-08 — Australian Publicly Funded Researcher Charge-Out Rate

**Classification:** Confirmed from client material

The Australian publicly funded researcher charge-out rate is calculated as:

`(total operating costs − non-UWA operating support) ÷ annual utilisation × 1.35`

**Source:** S1, S2.

**Current implementation note:**  
The workbook implements this class as a 1.35 uplift on the relevant minimum recovery calculation.

The issue calls this APFR/PFR, while workbook material also shows PFRI wording.

**Clarification:**  
Confirm the final label: APFR, PFR, PFRI or another client-approved term.

---

### BR-09 — Commercial Charge-Out Rate

**Classification:** Confirmed from client material

The commercial charge-out rate is calculated as:

`total operating costs ÷ annual utilisation × 1.35`

Commercial users include industry, non-research and other external users not covered by the public researcher category.

**Source:** S1, S2.

**Current implementation note:**  
The workbook confirms the 1.35 multiplier for the commercial row.

The context document links this treatment to competitive neutrality and notes that operator time may use UWA consultancy rates or a similar basis.

**Clarification:**  
Confirm whether any commercial services are exempt from the uplift.

---

### BR-10 — Indirect Cost Recovery Uplift

**Classification:** Confirmed from client material

A 35 percent indirect-cost recovery uplift applies to the APFR/PFRI and commercial formulas shown in the context document and workbook.

**Source:** S1, S2.

**Current implementation note:**  
The current application calculation also appears to apply a 1.35 multiplier to APFR and commercial rates.

**Clarification:**  
The issue wording says "where applicable", so exceptions and approval handling still need client confirmation.

---

### BR-11 — GST Treatment

**Classification:** Confirmed from client material

Calculated rates are intended to be GST-exclusive.

GST is added separately for external users where applicable, and GST is not treated as available income for facility operations.

**Source:** S1.

**Current implementation note:**  
Exports and user-facing summaries should preserve GST-exclusive wording so users do not treat GST as part of operating recovery.

**Clarification:**  
Confirm the exact wording required on PDF and CSV outputs.

---

### BR-12 — Benchmarking

**Classification:** Confirmed MVP requirement; structure pending client clarification

Benchmarking support is part of the client-approved MVP. Benchmark information supports pricing and review decisions but does not replace the operating-cost calculation.

**Source:** S1, S8.

**Current implementation note:**  
The repository includes benchmark-related data structures and aggregate reads, but it does not yet provide a complete benchmark entry, save and review workflow or automated benchmark coverage.

**Clarification:**  
Confirm whether notes are sufficient or a structured comparison is required, including the required provider, rate, source, difference and supporting-note fields.

---

### BR-13 — Approval Evidence

**Classification:** Confirmed MVP review evidence; full digital approval is a future enhancement

The approved MVP requires structured review information. A complete in-application digital approval workflow is a future enhancement.

**Source:** S1, S8.

**Current implementation note:**  
The application stores calculation snapshots and audit events, blocks submission or approval when the latest snapshot is stale, restricts approval to the Reviewer role and provides Audit History navigation. Relevant evidence includes PRs #34, #36, #40, #50, #52 and #53.

**Clarification:**  
Confirm the final review fields and the exact calculation/audit-history events, retention period and display behaviour required for the MVP. Approver fields, attachment uploads and the full digital approval workflow remain future work unless separately approved.

---

### BR-14 — Rate Communication

**Classification:** Confirmed MVP supporting output; communication workflow is a future enhancement

The approved MVP requires supporting output for review and communication. Automated distribution and rate-change communication are future enhancements.

**Source:** S1, S8.

**Current implementation note:**  
The application generates PDF and CSV outputs from the persisted calculation snapshot. PR #52 verifies that both formats remain consistent with the saved calculation.

**Clarification:**  
Confirm the final audience, wording and delivery process for rate communication if an automated workflow is introduced later.

---

### BR-15 — Shared and Platform-Level Cost Allocation

**Classification:** Pending client clarification

Shared or platform-level costs need an allocation rule before they can be attributed to individual capabilities.

The workbook appears to spread directly allocated costs across active capabilities, but the context document does not confirm a formal allocation driver.

**Source:** S1, S2, S5, S8.

**Current implementation note:**  
The current application appears to allocate shared platform costs equally across active capabilities.

That mirrors the workbook pattern but should not be treated as final policy without confirmation.

**Clarification:**  
Confirm whether allocation should be:

- equal;
- capacity-based;
- utilisation-based;
- staff-effort-based;
- revenue-based; or
- another basis.

---

### BR-16 — Proposed Rates and Recovery Comparison

**Classification:** Confirmed from client material

Users should be able to enter proposed rates and compare the financial recovery produced by those rates against the calculated minimum sustainable rates.

**Source:** S2.

**Current implementation note:**  
The workbook has proposed UWA, APFR/PFRI and commercial rate rows and recovery comparison rows that calculate proposed recovery and the difference from minimum recovery.

**Clarification:**  
Confirm whether proposed rates require justification notes when they are below the calculated sustainable rate.

---

### BR-17 — Current Calculation Alignment

**Classification:** Proposed

The current application formulas should remain aligned with the confirmed formulas in the context document and workbook.

Calculation changes should be versioned or documented so later exports can be traced to the rule set used at the time.

**Source:** S1, S2, S5.

**Current implementation note:**  
The current implementation appears to calculate UWA, APFR and commercial rates using the same formula family as S1 and S2.

**Clarification:**  
Confirm whether the client requires an explicit calculation version label in exports.

---

### BR-18 — Justification and Evidence Traceability

**Classification:** Confirmed MVP justification/evidence requirement

The approved MVP requires justification and supporting evidence for material costs, utilisation assumptions and pricing decisions.

**Source:** S8.

**Current implementation note:**  
The application records justification notes for costs, income, capacity and proposed rates. This catalogue and the RTM use source IDs, implementation references, tests, Issues and PRs to preserve traceability.

**Clarification:**  
Confirm whether the final workflow requires uploaded evidence attachments in addition to notes and links.

---

### BR-19 — Benchmark Data Persistence

**Classification:** Confirmed MVP benchmarking support; record structure, retention and mandatory-record requirement pending client clarification

Benchmarking support and the ability to record benchmark information are part of the approved MVP. The exact fields, retention behaviour and whether a benchmark record is mandatory before review or submission remain pending client clarification.

**Source:** S1, S2, S5, S8.

**Current implementation note:**  
The repository includes benchmark-related structures and aggregate reads, but the current implementation does not provide a complete save flow, user interface or automated test.

**Clarification:**  
Confirm the required benchmark fields, evidence threshold, retention behaviour and whether a benchmark record is mandatory before review or submission.

---

### BR-20 — Document Export

**Classification:** Confirmed MVP supporting output; format pending client clarification

The calculator should support exportable outputs so assumptions, rates and review evidence can be shared for approval and communication.

**Source:** S1, S3, S4, S5, S8.

**Current implementation note:**  
The application provides PDF and CSV exports generated from the persisted calculation snapshot. PRs #23 and #52 provide formatting and snapshot-consistency evidence.

**Clarification:**  
Confirm the exact fields required in the final PDF and CSV exports.

---

## Differences and Gaps

| Topic | Observed difference or gap | Catalogue treatment |
|---|---|---|
| APFR / PFR / PFRI terminology | The context and issue use Australian publicly funded researcher wording, while workbook/user-group material also shows PFRI. The label must be confirmed before final field names and exports are locked. | Displayed terminology as pending client confirmation. |
| Shared cost allocation | The workbook suggests equal spreading of directly allocated costs across active capabilities, and the current application appears to follow equal allocation. The client methodology does not explicitly state that equal allocation is the final rule. | Keep shared/platform cost allocation as pending until the client confirms the allocation driver. |
| Equipment replacement recovery | The agreement places equipment replacement and recovery outside the approved MVP unless later confirmed as essential. | Record it as a future enhancement rather than an incomplete MVP requirement. |
| Benchmarking implementation | Benchmarking support and recording are approved for the MVP, but the exact fields, retention behaviour and whether a record is mandatory before review or submission remain unresolved. | Record the current workflow as partially satisfied without treating a benchmark record as mandatory until the client confirms that requirement. |
| Review and audit history | Structured review information is required, and snapshots, stale-state controls and Audit History navigation are implemented. The exact events, retained fields and history behaviour are not fully client-confirmed. | Treat the current evidence as implemented, keep detailed review/audit behaviour pending and leave a full digital approval workflow as a future enhancement. |
| GST export wording | The context confirms GST-exclusive rates and separate GST handling for external users. The exact export wording and invoice boundary still need approval. | Export wording as a clarification question. |
| PDF and CSV output | Snapshot-consistent PDF and CSV exports are implemented, but the final required fields, wording and retained audit information remain unresolved. | Treat supporting output as MVP functionality and keep final format details pending clarification. |

---

## Client Confirmation Questions

| ID | Question |
|---|---|
| Q-01 | What final label should the application and exports use for the Australian publicly funded researcher category: APFR, PFR, PFRI or another term? |
| Q-02 | When does the 35 percent indirect-cost recovery uplift apply, and are any user types, service types or capabilities exempt? |
| Q-03 | How should Non-Variable Operating Income and Non-UWA Operating Support be mapped to input fields and formulas? |
| Q-04 | Which billable units are allowed, and do non-hour units require conversion rules or separate capacity assumptions? |
| Q-05 | What historical utilisation period and forecast horizon must be captured for each capability? |
| Q-06 | Should the standard year and machine-year capacity assumptions be fixed defaults, editable defaults or examples only? |
| Q-07 | What allocation driver should be used for shared or platform-level costs? |
| Q-08 | If equipment replacement or recovery becomes essential in a future scope, what replacement value, recovery period and calculation treatment should be used? |
| Q-09 | What benchmark fields, evidence sources, comparison structure and update frequency are required? |
| Q-10 | Must a benchmark record exist before review or submission, and does it only support the decision or affect any calculation? |
| Q-11 | Do proposed rates below the calculated sustainable rate require justification notes or extra approval? |
| Q-12 | What rounding, currency precision and decimal display rules should be used in the application and exports? |
| Q-13 | What exact GST-exclusive wording should appear in PDF and CSV outputs? |
| Q-14 | Which review fields and calculation/audit-history events must the MVP retain and display? |
| Q-15 | What exact fields, ordering, wording and audit information must appear in the final PDF and CSV outputs? |

---

## Acceptance Criteria Coverage

| Issue #45 criterion | Coverage |
|---|---|
| Review the client-approved MVP agreement against the current RTM. | Complete. S8 is mapped across the RTM and the approved scope is separated from remaining implementation clarifications. |
| Update MVP status wording where the scope is formally approved. | Complete. Approved requirements are marked as MVP; equipment replacement and full digital approval/communication workflows are identified as future enhancements. |
| Preserve pending implementation clarifications. | Complete. Benchmarking structure, shared/platform allocation, external-researcher terminology, review/audit behaviour and final PDF/CSV details remain explicit. |
| Update source references. | Complete. The client-approved agreement, Issues #45/#46 and merged PR/test evidence are referenced. |
| Keep the RTM, Rule and Sources tabs consistent with this analysis. | Complete. BR-01 to BR-20 use the same scope classifications and source treatment. |
| Do not introduce unsupported business rules. | Complete. Scope changes are tied to S8, while implementation evidence is identified separately from client policy. |
