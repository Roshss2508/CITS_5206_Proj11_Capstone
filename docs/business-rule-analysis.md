# Business Rule Analysis

## Source Material Reviewed

| ID | Source | Use in this catalogue |
|---|---|---|
| S1 | `01_CONTEXT-Costing & Pricing Research Infrastructure.docx` | Primary client methodology for research infrastructure costing, rate calculation, GST treatment, benchmarking, approval and communication. |
| S2 | `02_TEMPLATE-RIC Cost Calculator.xlsx` | Existing RIC Cost Calculator workbook used to verify spreadsheet structure, formulas, capability allocation, proposed rates and recovery comparison. |
| S3 | `03_EXAMPLE-Project Costing Template.docx` | Comparable project costing example. It supports guided input, editable assumptions, output review and export patterns, but it is not the source for RIC platform formulas. |
| S4 | `04_EXAMPLE-UniSuper Calculator.docx` | Comparable calculator user experience reference. It supports the guided calculator pattern, adjustable inputs, forecast output and export pattern. |
| S5 | Current application and repository review | Used to record how the current implementation appears to handle calculations, benchmarking, exports and persistence. It is not treated as client policy by itself. |
| S6 | GitHub issue task description | Defines the deliverable scope and acceptance criteria. It is not used as evidence for business rules unless supported by client material or the current implementation. |

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

**Classification:** Confirmed from client material

The methodology focuses on operating costs rather than historical capital expenditure.

Future replacement should still be considered where appropriate, for example by incorporating an annual recovery target based on a replacement value and recovery period.

**Source:** S1.

**Current implementation note:**  
The workbook background material includes capability foundation details, replacement values, replacement timing and maintenance contract notes.

**Clarification:**  
Confirm when equipment replacement becomes part of the calculated rate rather than supporting context.

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

**Classification:** Confirmed from client material

Benchmarking should be considered before rate approval.

Relevant sources can include:

- NCRIS facilities;
- other Australian universities;
- commercial laboratories; and
- international facilities.

Benchmarking informs pricing but does not replace the operating-cost calculation.

**Source:** S1.

**Current implementation note:**  
The workbook contains a competitor pricing background sheet, but the inspected workbook has no visible non-empty competitor pricing entries.

**Clarification:**  
Confirm required benchmark fields, evidence threshold and whether benchmark entries should be mandatory before approval.

---

### BR-13 — Approval Evidence

**Classification:** Confirmed from client material

Before implementation, rates should be supported by documented costing assumptions, utilisation assumptions and benchmarking.

Approval should be obtained from the delegated authority, typically the head of the business unit responsible for operating costs, and records should be retained for audit and review.

**Source:** S1.

**Current implementation note:**  
The current application should support exportable review summaries so approval evidence can be retained outside the system if formal approval workflow is not implemented.

**Clarification:**  
Confirm whether the application itself needs approval states, approver fields and attachment uploads.

---

### BR-14 — Rate Communication

**Classification:** Confirmed from client material

Approved rates and price changes should be communicated clearly before rollout, including why the price changed and how the methodology supports sustainable infrastructure operation.

**Source:** S1.

**Current implementation note:**  
The application can support this by producing clear PDF/CSV summaries, but the communication workflow itself may remain outside the MVP.

**Clarification:**  
Confirm whether rate-change notices are part of the system scope.

---

### BR-15 — Shared and Platform-Level Cost Allocation

**Classification:** Pending client confirmation

Shared or platform-level costs need an allocation rule before they can be attributed to individual capabilities.

The workbook appears to spread directly allocated costs across active capabilities, but the context document does not confirm a formal allocation driver.

**Source:** S1, S2, S5.

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

**Classification:** Proposed

Each business rule, formula and material assumption should be traceable to either:

- client material;
- the existing calculator;
- the current implementation; or
- an explicit client clarification.

**Source:** S6.

**Current implementation note:**  
This catalogue uses source IDs and classification status to support traceability.

**Clarification:**  
Confirm whether the client expects evidence attachments, links, screenshots or notes at the rule level.

---

### BR-19 — Benchmark Data Persistence

**Classification:** Pending client confirmation

The system should clarify whether benchmark data is only review context or a required record that must be saved with each case.

**Source:** S1, S2, S5.

**Current implementation note:**  
The repository includes benchmark-related structures, but the reviewed current implementation does not appear to provide a complete benchmarking save flow in the UI/API.

**Clarification:**  
Confirm whether benchmarking is mandatory for MVP acceptance and what data must be stored.

---

### BR-20 — Document Export

**Classification:** Pending client confirmation

The calculator should support exportable outputs so assumptions, rates and review evidence can be shared for approval and communication.

**Source:** S1, S3, S4, S5.

**Current implementation note:**  
The example documents support exportable calculator outputs, and the current application includes PDF/CSV export routes.

**Clarification:**  
Confirm the exact fields required in the final PDF and CSV exports.

---

## Differences and Gaps

| Topic | Observed difference or gap | Catalogue treatment |
|---|---|---|
| APFR / PFR / PFRI terminology | The context and issue use Australian publicly funded researcher wording, while workbook/user-group material also shows PFRI. The label must be confirmed before final field names and exports are locked. | Displayed terminology as pending client confirmation. |
| Shared cost allocation | The workbook suggests equal spreading of directly allocated costs across active capabilities, and the current application appears to follow equal allocation. The client methodology does not explicitly state that equal allocation is the final rule. | Keep shared/platform cost allocation as pending until the client confirms the allocation driver. |
| Equipment replacement recovery | The context document supports considering future replacement, and the workbook contains replacement values and timing. It does not fully define when the replacement amount must be included in charge-out calculations. | Record equipment recovery as a supported concept with implementation details pending. |
| Benchmarking implementation | The context document requires benchmarking as part of approval, but the workbook competitor pricing sheet is empty and the current application review found incomplete benchmarking persistence. | Record benchmarking as a confirmed requirement, with required fields and MVP behaviour still unresolved. |
| GST export wording | The context confirms GST-exclusive rates and separate GST handling for external users. The exact export wording and invoice boundary still need approval. | Export wording as a clarification question. |

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
| Q-08 | When should equipment replacement or recovery costs be included in the calculated charge-out rates? |
| Q-09 | What benchmark fields, evidence sources and update frequency are required? |
| Q-10 | Is benchmarking mandatory before approval, and does benchmark data alter calculated rates or only support review decisions? |
| Q-11 | Do proposed rates below the calculated sustainable rate require justification notes or extra approval? |
| Q-12 | What rounding, currency precision and decimal display rules should be used in the application and exports? |
| Q-13 | What exact GST-exclusive wording should appear in PDF and CSV outputs? |
| Q-14 | Does the system need built-in approval states, approver fields and attachment uploads, or is export for external approval sufficient? |

---

## Acceptance Criteria Coverage
