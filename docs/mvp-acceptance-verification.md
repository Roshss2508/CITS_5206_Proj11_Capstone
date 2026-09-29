# MVP Acceptance Criteria Verification

## Purpose

This document verifies the implemented Research Infrastructure Costing and Pricing Decision-Support Tool against the client-approved MVP acceptance criteria. It identifies which criteria are satisfied, which remain incomplete, and which depend on a client decision.

The verification was performed against local `main` commit `027a85a` (`feat: prompt for recalculation in Steps 4 and 5 when the snapshot is stale (#40)`). The GitHub branch should be refreshed before this document is merged so the commit reference and evidence remain current.

## Evidence Reviewed

- Client-approved MVP proposal and agreement: `Proposed MVP client agreement - ES agreed.docx`.
- [Requirements Traceability Matrix](Traceability_Matrix_Updated.xlsx).
- [Business Rule Analysis](business-rule-analysis.md).
- [Implemented business rules](business-rules.md).
- Current application code, API routes, database schema, and automated tests.
- Merged implementation and test evidence, including [PR #14](https://github.com/Roshss2508/CITS_5206_Proj11_Capstone/pull/14), [PR #34](https://github.com/Roshss2508/CITS_5206_Proj11_Capstone/pull/34), [PR #38](https://github.com/Roshss2508/CITS_5206_Proj11_Capstone/pull/38), and [PR #40](https://github.com/Roshss2508/CITS_5206_Proj11_Capstone/pull/40).
- A clean local quality run on 29 September 2026.

## Status Definitions

- **Satisfied:** The criterion is implemented and supported by code, automated tests, or observed output.
- **Partially satisfied:** A usable implementation exists, but an agreed detail or part of the expected behaviour remains incomplete.
- **Not yet satisfied:** The current application does not provide a usable implementation of the criterion.
- **Pending clarification:** Completion cannot be determined until the client confirms the required behaviour or accepts the final result.

## Summary

| Status | Count |
|---|---:|
| Satisfied | 10 |
| Partially satisfied | 2 |
| Not yet satisfied | 1 |
| Pending clarification | 1 |
| **Total** | **14** |

The implemented application supports the main Steps 1-5 workflow, the agreed sustainable-rate calculations, validation, review, snapshot protection, and PDF/CSV output. The most significant uncovered implementation gap is benchmarking capture: the database schema contains a benchmark table, but users have no complete UI or API workflow for saving benchmark records. Shared-cost allocation and the final required export content also remain dependent on client confirmation.

## Detailed Verification

| ID | Client-approved acceptance criterion | Current implementation and evidence | Status | Remaining gap or action |
|---|---|---|---|---|
| AC-01 | A user can create a costing case and enter the required platform and capability information. | Case creation is implemented by `app/api/v1/cases/route.ts`. Step 1 in [CaseWizard](../components/CaseWizard.tsx) supports 1-20 capabilities and hour, day, or sample billing units. [The core workflow test](../tests/e2e/workflow.spec.ts) creates a case, enters platform details, adds a capability, and saves Step 1 in Chrome and Edge. | **Satisfied** | None identified. |
| AC-02 | A user can record the required operating costs and relevant non-variable operating support. | Step 2 separates operating costs from recurrent UWA and non-UWA support, includes supported cost categories, and explicitly excludes user fees from support income. The costs and income API routes validate and persist the records. The core workflow test enters an annual platform cost and verifies persistence after navigation. | **Satisfied** | Automated browser coverage uses one representative cost. The broader category set is supported by the UI and validation schema. |
| AC-03 | A user can enter capacity, historical utilisation, and forecast utilisation information. | Step 3 provides maximum realistic capacity, three historical utilisation fields, forecast utilisation, derived forecast units, and forecast justification. `app/api/v1/cases/[id]/capacity/route.ts` persists the values. Unit and browser tests cover forecast utilisation limits and zero forecast units. | **Satisfied** | Add a focused browser test for historical-year persistence to strengthen evidence; this is a test-coverage improvement rather than a known functional failure. |
| AC-04 | Required fields are validated before calculations are completed. | [Validation schemas](../src/modules/validation.ts) enforce required identifiers, labels, amounts, justifications, capacity, utilisation, and user-share rules. [Validation E2E tests](../tests/e2e/validation.spec.ts) confirm that invalid utilisation blocks navigation and that review is unavailable before calculation. [Capability-integrity tests](../tests/e2e/capability-integrity.spec.ts) verify invalid and cross-case capability references are rejected before records are replaced. | **Satisfied** | None identified. |
| AC-05 | Important assumptions can be supported by appropriate justification or evidence. | Costs, support income, capacity forecasts, and proposed pricing each have justification fields. Validation requires non-empty justification for the relevant records. PDF output includes cost, utilisation, and proposed-rate justifications. | **Satisfied** | File attachments are not implemented, but the approved criterion does not require attachments. Confirm separately if the client expects uploaded evidence rather than recorded justification. |
| AC-06 | The application applies the costing and pricing rules agreed with the client. | [RIC Formula V1](../src/modules/calculation/index.ts) applies the documented cost, support, capacity, APFR/commercial uplift, user-mix, and GST-exclusive rules. [Calculation tests](../tests/calculation.test.ts) verify the formula family and equal platform-cost allocation. | **Partially satisfied** | Core formula rules are implemented. The final allocation basis for shared platform costs and any exceptions to the 35% uplift remain client-dependent. Do not change the formula until those decisions are confirmed. |
| AC-07 | Minimum sustainable charge-out rates are calculated correctly for the agreed user categories. | The calculation engine produces UWA, Australian Publicly Funded Researcher, and Commercial rates. The golden calculation test verifies `$100.00`, `$162.00`, and `$202.50`, the 35% overhead components, GST exclusion, support treatment, and formula version `RIC_FORMULA_V1`. | **Satisfied** | Final APFR/PFR/PFRI display terminology remains a client clarification but does not change the tested calculation. |
| AC-08 | A user can review and revise relevant assumptions and proposed pricing information. | Users can navigate back through the wizard, revise inputs, enter proposed rates and user mix, and recalculate. [Workflow tests](../tests/e2e/workflow.spec.ts) verify saved data survives navigation. [Snapshot-freshness tests](../tests/e2e/stale-snapshot.spec.ts) verify that changed calculation inputs invalidate the previous snapshot and block submission until recalculation. | **Satisfied** | None identified. |
| AC-09 | A user can compare relevant pricing assumptions or scenarios as agreed with the client. | Step 4 displays calculated minimum rates beside editable proposed rates, expected UWA/APFR/Commercial user mix, gross revenue, university overhead, net platform recovery, and operating balance. Calculation tests verify proposed-rate recovery and the requirement that user shares total 100%. | **Satisfied** | The MVP supports comparison of a proposed scenario with minimum sustainable rates. Multiple named or saved scenarios are not implemented and should not be assumed unless requested by the client. |
| AC-10 | Relevant benchmarking information can be recorded at the level agreed with the client. | A `benchmarks` table and benchmark type exist, and aggregate reads include benchmark records. No complete benchmark entry UI, write API, or automated benchmark workflow test exists. | **Not yet satisfied** | Confirm whether the client requires simple notes or structured benchmark records, then create a focused implementation issue. The current application does not give users a usable way to record benchmarking information. |
| AC-11 | The application presents key costing and pricing results in a clear format suitable for review and decision-making. | Step 4 and Step 5 present sustainable rates, proposed rates, forecast units, operating cost, revenue, overhead, net recovery, operating balance, formula version, snapshot time, and audit evidence. The workflow test confirms Step 5 reproduces the persisted Step 4 snapshot after reload. | **Satisfied** | A final client usability review is still required under AC-14. |
| AC-12 | The agreed supporting output can be generated or retained in the format confirmed with the client. | PDF and CSV routes export the latest immutable calculation snapshot. The workflow test verifies PDF signature/content type and confirms the CSV sustainable rate matches the Step 4 result. | **Partially satisfied** | PDF and CSV are implemented, but the required final fields, GST wording, and whether another retained format is needed remain pending client confirmation. |
| AC-13 | Key calculations are validated against the existing RIC Cost Calculator and/or client-approved reference examples. | `tests/calculation.test.ts` contains a documented client golden calculation and verifies sustainable rates, overhead, revenue, recovery, operating balance, support treatment, allocation behaviour, precision, and formula version. All 73 unit tests passed in this verification run. | **Satisfied** | Preserve the source/reference values used by the golden test when the calculation methodology is updated. |
| AC-14 | The client confirms that the final MVP workflow and outputs meet the agreed MVP scope. | The client has approved the proposed scope and acceptance criteria, allowing this implementation verification to proceed. Final acceptance of the implemented workflow and outputs has not been recorded in the repository evidence reviewed. | **Pending clarification** | Demonstrate the current MVP to the client and record explicit acceptance, requested changes, or outstanding conditions. |

## Identified Gaps and Follow-up Work

### GAP-01: Benchmark capture is not implemented

**Significance:** High. This is the only acceptance criterion with no usable end-user workflow.

**Recommended follow-up issue:** `[FE/BE] Add MVP benchmarking capture and persistence`

The issue should define the client-approved level of detail first, then add the required UI, API validation, persistence, review output, and automated coverage. At minimum, the agreement proposes provider, comparable rate, source/reference, relevant differences, and supporting notes.

### GAP-02: Shared-cost allocation and uplift applicability remain client-dependent

**Significance:** Medium. The application consistently uses equal allocation and a 1.35 external multiplier, but those policy details should not be presented as final client policy until confirmed.

**Recommended follow-up:** Record a client-clarification decision. If the agreed rule differs from `RIC_FORMULA_V1`, create a separate versioned formula-change issue with updated golden tests. Existing snapshots must not be overwritten.

### GAP-03: Final supporting-output requirements remain unresolved

**Significance:** Medium. PDF and CSV export work, but the client has not confirmed the exact required fields, GST wording, or whether another retained format is necessary.

**Recommended follow-up:** Obtain client confirmation, then create a focused export issue only if the confirmed fields differ from the current output.

### GAP-04: Historical-utilisation browser coverage is incomplete

**Significance:** Low. The UI, schema, API, and database support three historical values, but the current browser suite does not explicitly enter, save, reload, and verify those fields.

**Recommended follow-up issue:** `[TEST] Verify historical utilisation and justification persistence`

### GAP-05: Final client acceptance is outstanding

**Significance:** Release gate. Scope approval is not the same as acceptance of the completed implementation.

**Recommended follow-up:** Run a client walkthrough using a synthetic reference case and record the client's decision against AC-14.

## Automated Verification Results

The following checks were run successfully on 29 September 2026:

| Check | Result |
|---|---|
| `npm run lint` | Passed |
| `npm run typecheck` | Passed |
| `npm run test` | Passed: 5 files, 73 tests |
| `npm run build` | Passed |
| `npm run test:e2e` | Passed: 36 tests across Chrome and Edge |

The browser suite covered dashboard access, business-rule navigation, the Steps 1-5 workflow, validation and empty states, PDF/CSV output, capability-reference integrity, restore behaviour, snapshot freshness, recalculation, submission protection, and role/status behaviour.

## Completion Assessment for Issue #46

- All 14 client-approved acceptance criteria have been reviewed against the implementation.
- Every criterion has an explicit status and supporting evidence.
- Remaining implementation and test gaps are identified.
- Client-dependent items are not presented as completed requirements.
- Follow-up work is separated from this verification task.
- Findings are consistent with the RTM and Business Rule Analysis, subject to the noted updates for the approved MVP scope.

Issue #46 can be closed after this document is reviewed, any agreed corrections are merged, and the significant follow-up gaps are recorded as separate issues. AC-14 must remain pending until explicit final client acceptance is recorded.
