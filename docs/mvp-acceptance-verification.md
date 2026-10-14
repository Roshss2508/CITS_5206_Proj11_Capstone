# MVP Acceptance Criteria Verification

## Purpose

This document verifies the implemented Research Infrastructure Costing and Pricing Decision-Support Tool against the client-approved MVP acceptance criteria. It identifies which criteria are satisfied, which remain incomplete, and which depend on a client decision.

The verification was refreshed against integrated `main` commit [`09dedb1`](https://github.com/Roshss2508/CITS_5206_Proj11_Capstone/commit/09dedb185bbe0a34462037f80d5b5538637748ee) (`fix: verify backend release boundaries and atomic plan saves (#69) (#73)`) on 14 October 2026. All 14 criteria were reassessed against this baseline. Open-PR work is excluded from completed implementation evidence; team-reported QA findings and independently repeated checks are identified separately below. Scope approval is not final client acceptance or production-deployment approval.

## Evidence Reviewed

- Client-approved MVP proposal and agreement: `Proposed MVP client agreement - ES agreed.docx`.
- [Requirements Traceability Matrix](Traceability_Matrix_Updated.xlsx).
- [Business Rule Analysis](business-rule-analysis.md).
- [Implemented business rules](business-rules.md).
- Current application code, API routes, database schema, and automated tests.
- Core workflow and validation evidence, including [PR #14](https://github.com/Roshss2508/CITS_5206_Proj11_Capstone/pull/14), [PR #34](https://github.com/Roshss2508/CITS_5206_Proj11_Capstone/pull/34), [PR #38](https://github.com/Roshss2508/CITS_5206_Proj11_Capstone/pull/38), and [PR #40](https://github.com/Roshss2508/CITS_5206_Proj11_Capstone/pull/40).
- Latest merged integration evidence: [PR #36](https://github.com/Roshss2508/CITS_5206_Proj11_Capstone/pull/36), [PR #37](https://github.com/Roshss2508/CITS_5206_Proj11_Capstone/pull/37), [PR #49](https://github.com/Roshss2508/CITS_5206_Proj11_Capstone/pull/49), [PR #50](https://github.com/Roshss2508/CITS_5206_Proj11_Capstone/pull/50), [PR #51](https://github.com/Roshss2508/CITS_5206_Proj11_Capstone/pull/51), [PR #52](https://github.com/Roshss2508/CITS_5206_Proj11_Capstone/pull/52), [PR #53](https://github.com/Roshss2508/CITS_5206_Proj11_Capstone/pull/53), [PR #57](https://github.com/Roshss2508/CITS_5206_Proj11_Capstone/pull/57), [PR #59](https://github.com/Roshss2508/CITS_5206_Proj11_Capstone/pull/59), [PR #63](https://github.com/Roshss2508/CITS_5206_Proj11_Capstone/pull/63), and [PR #64](https://github.com/Roshss2508/CITS_5206_Proj11_Capstone/pull/64).
- Client-approved scope wording and repository status updated by [PR #60](https://github.com/Roshss2508/CITS_5206_Proj11_Capstone/pull/60).
- Approved-scope RTM and business-rule alignment under [Issue #45](https://github.com/Roshss2508/CITS_5206_Proj11_Capstone/issues/45), merged in [PR #66](https://github.com/Roshss2508/CITS_5206_Proj11_Capstone/pull/66).
- Final integration changes: [PR #65](https://github.com/Roshss2508/CITS_5206_Proj11_Capstone/pull/65) (UI and responsive-layout changes), [PR #70](https://github.com/Roshss2508/CITS_5206_Proj11_Capstone/pull/70) (parameter-safe Step 2 batching), [PR #71](https://github.com/Roshss2508/CITS_5206_Proj11_Capstone/pull/71) (duplicate-save protection), [PR #72](https://github.com/Roshss2508/CITS_5206_Proj11_Capstone/pull/72) (reviewer-decision tests), and [PR #73](https://github.com/Roshss2508/CITS_5206_Proj11_Capstone/pull/73) (backend release boundaries and atomic plan/copy saves).
- Final UI, responsive and cross-browser QA tracked by [Issue #67](https://github.com/Roshss2508/CITS_5206_Proj11_Capstone/issues/67). The project owner's latest review comment reports that #67 is complete, with 116 passing Playwright executions across Chrome and Edge and no identified demonstration-blocking regressions. This is team-reported QA evidence, not final client acceptance.
- Repository evidence: [Step 2 batching verification](testing/step2-batching.md), [duplicate-save verification](testing/persistence-deduplication.md), and [backend release-readiness verification](testing/backend-release-readiness.md).

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

The implemented application supports the main Steps 1-5 workflow, the agreed sustainable-rate calculations, validation, review, snapshot protection, historical snapshot browsing, audit-history navigation, read-only submitted cases, and snapshot-specific PDF/CSV output. The most significant uncovered implementation gap is benchmarking capture: the database schema contains a benchmark table, but users have no complete UI or API workflow for saving benchmark records. Shared-cost allocation and the final required export content also remain dependent on client confirmation.

The final-main reassessment retains the status counts above. UI/regression completion and stronger persistence/reviewer tests add evidence for existing functionality; they do not complete benchmarking capture or resolve client-dependent policy, output or acceptance decisions. In the RTM and Business Rule Analysis, benchmarking support is part of the approved MVP, while its fields, retention and mandatory-record requirement remain pending. AC-10 is marked **Not yet satisfied** specifically because no usable recording workflow exists; this does not make benchmark entry mandatory before submission or treat the entire benchmarking requirement as outside the MVP.

## Detailed Verification

| ID | Client-approved acceptance criterion | Current implementation and evidence | Status | Remaining gap or action |
|---|---|---|---|---|
| AC-01 | A user can create a costing case and enter the required platform and capability information. | Case creation is implemented by `app/api/v1/cases/route.ts`. Step 1 in [CaseWizard](../components/CaseWizard.tsx) supports 1-20 capabilities and hour, day, or sample billing units. [The core workflow test](../tests/e2e/workflow.spec.ts) creates a case, enters platform details, adds a capability, and saves Step 1 in Chrome and Edge. | **Satisfied** | None identified. |
| AC-02 | A user can record the required operating costs and relevant non-variable operating support. | Step 2 separates operating costs from recurrent UWA and non-UWA support and excludes user fees. [PR #70](https://github.com/Roshss2508/CITS_5206_Proj11_Capstone/pull/70) batches INSERTs within one atomic save; [PR #71](https://github.com/Roshss2508/CITS_5206_Proj11_Capstone/pull/71) avoids unchanged rewrites and misleading audits. [Step 2 atomic tests](../tests/e2e/step2-atomic.spec.ts) cover 200 costs, 100 income records, empty collections and late-chunk rollback; [workflow tests](../tests/e2e/workflow.spec.ts) verify deleted-row persistence. | **Satisfied** | Hosted quotas and concurrent editing remain separate release limits; local data-safety evidence does not establish hosted capacity. |
| AC-03 | A user can enter capacity, historical utilisation, and forecast utilisation information. | Step 3 provides maximum realistic capacity, three historical utilisation fields, forecast utilisation, forecast units and justification. [Persistence tests](../tests/persistence-deduplication.test.ts) verify changed historical values and evidence. [Backend release tests](../tests/e2e/backend-release-readiness.spec.ts) persist representative historical inputs through the real APIs and verify snapshot inputs; PR #73 adds parameter-safe, atomic capacity saves for 20 capabilities. | **Satisfied** | Repository/API evidence is stronger, but explicit browser entry, save and reload of all three historical fields remains a coverage improvement rather than a known functional failure. |
| AC-04 | Required fields are validated before calculations are completed. | [Validation schemas](../src/modules/validation.ts) enforce identifiers, labels, amounts, justifications, capacity, utilisation and user shares. [Validation tests](../tests/e2e/validation.spec.ts) cover invalid utilisation and missing snapshots; [capability-integrity tests](../tests/e2e/capability-integrity.spec.ts) reject unknown/cross-case references. [Backend release tests](../tests/e2e/backend-release-readiness.spec.ts) verify invalid amounts, collection bounds, user mix, role/read-only errors and preservation of persisted data. | **Satisfied** | Required-input validation is evidenced. Malformed-JSON handling and consistent error envelopes remain separate hardening work documented in the backend release report. |
| AC-05 | Important assumptions can be supported by appropriate justification or evidence. | Costs, support income, capacity forecasts, and proposed pricing each have justification fields. Validation requires non-empty justification for the relevant records. PDF output includes cost, utilisation, and proposed-rate justifications. | **Satisfied** | File attachments are not implemented, but the approved criterion does not require attachments. Confirm separately if the client expects uploaded evidence rather than recorded justification. |
| AC-06 | The application applies the costing and pricing rules agreed with the client. | [RIC Formula V1](../src/modules/calculation/index.ts) applies the documented cost, support, capacity, APFR/commercial uplift, user-mix, and GST-exclusive rules. [Calculation tests](../tests/calculation.test.ts) verify the formula family and equal platform-cost allocation. | **Partially satisfied** | Core formula rules are implemented. The final allocation basis for shared platform costs and any exceptions to the 35% uplift remain client-dependent. Do not change the formula until those decisions are confirmed. |
| AC-07 | Minimum sustainable charge-out rates are calculated correctly for the agreed user categories. | The calculation engine produces UWA, Australian Publicly Funded Researcher, and Commercial rates. The golden calculation test verifies `$100.00`, `$162.00`, and `$202.50`, the 35% overhead components, GST exclusion, support treatment, and formula version `RIC_FORMULA_V1`. | **Satisfied** | Final APFR/PFR/PFRI display terminology remains a client clarification but does not change the tested calculation. |
| AC-08 | A user can review and revise relevant assumptions and proposed pricing information. | [Workflow tests](../tests/e2e/workflow.spec.ts) verify navigation, role continuity and autosave; [snapshot-freshness tests](../tests/e2e/stale-snapshot.spec.ts) block stale submission. [Read-only tests](../tests/e2e/readonly-ready-for-review.spec.ts) protect submitted inputs. [PR #72 reviewer-decision tests](../tests/e2e/reviewer-decision.spec.ts) verify Reviewer-only approval, approved-case read-only protection, and Changes Required returning a case to an editable Draft. [Duplicate-save tests](../tests/e2e/persistence-deduplication.spec.ts) preserve genuine changes without repeated audits. | **Satisfied** | Demo-role workflow is implemented; production identity and the exact client-required review fields remain separate decisions. |
| AC-09 | A user can compare relevant pricing assumptions or scenarios as agreed with the client. | Step 4 displays calculated minimum rates beside editable proposed rates, expected UWA/APFR/Commercial user mix, gross revenue, university overhead, net platform recovery, and operating balance. Calculation tests verify proposed-rate recovery and the requirement that user shares total 100%. | **Satisfied** | The MVP supports comparison of a proposed scenario with minimum sustainable rates. Multiple named or saved scenarios are not implemented and should not be assumed unless requested by the client. |
| AC-10 | Relevant benchmarking information can be recorded at the level agreed with the client. | A `benchmarks` table and benchmark type exist, and aggregate reads include benchmark records. No complete benchmark entry UI, write API, or automated benchmark workflow test exists. | **Not yet satisfied** | Confirm whether the client requires simple notes or structured benchmark records, then create a focused implementation issue. The current application does not give users a usable way to record benchmarking information. |
| AC-11 | The application presents key costing and pricing results in a clear format suitable for review and decision-making. | Steps 4-5 present rates, forecast units, costs, revenue, overhead, recovery, balance and snapshot metadata. [Snapshot-history tests](../tests/e2e/step5-snapshot-history-selector.spec.ts) and [audit-navigation tests](../tests/e2e/audit-navigation.spec.ts) verify review access. [PR #65](https://github.com/Roshss2508/CITS_5206_Proj11_Capstone/pull/65) integrates the UI/responsive redesign; final QA under [Issue #67](https://github.com/Roshss2508/CITS_5206_Proj11_Capstone/issues/67) reports 116 passing Chrome/Edge test executions and no identified demo-blocking regressions. | **Satisfied** | Team QA supports current presentation; final client usability acceptance remains pending under AC-14. |
| AC-12 | The agreed supporting output can be generated or retained in the format confirmed with the client. | PDF and CSV routes export immutable calculation snapshots. [PDF consistency tests](../tests/e2e/export-snapshot-consistency.spec.ts) verify that later edits or recalculations do not alter an earlier snapshot's report. [CSV snapshot tests](../tests/e2e/csv-export-by-snapshot.spec.ts) verify snapshot-specific figures, creation time, formula version, creator metadata and invalid-snapshot handling. Step 5 links each selected historical snapshot to its matching PDF and CSV exports. | **Partially satisfied** | Snapshot-consistent PDF and CSV output is implemented, but the required final fields, GST wording, and whether another retained format is needed remain pending client confirmation. |
| AC-13 | Key calculations are validated against the existing RIC Cost Calculator and/or client-approved reference examples. | [Calculation tests](../tests/calculation.test.ts) retain the documented golden reference. [PR #73 HTTP tests](../tests/e2e/backend-release-readiness.spec.ts) persist the reference inputs through the real APIs and verify rates of $100.00/$162.00/$202.50, revenue of $130875.00, overhead of $18375.00, net recovery of $112500.00 and balance of $12500.00, together with immutable snapshot inputs/results and recalculation behaviour. | **Satisfied** | Preserve reference values and provenance. Automated agreement with the reference does not confirm unresolved policy details or final client acceptance. |
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

**Significance:** Low. Repository tests now cover changed historical values and evidence, and the backend HTTP golden case persists representative historical inputs and verifies snapshot inputs. The browser suite still does not explicitly enter all three historical values through the UI, save, reload and check the fields. This narrower UI coverage gap is not a known persistence defect.

**Recommended follow-up issue:** `[TEST] Verify historical utilisation and justification persistence`

### GAP-05: Final client acceptance is outstanding

**Significance:** Release gate. Scope approval is not the same as acceptance of the completed implementation.

**Recommended follow-up:** Run a client walkthrough using a synthetic reference case and record the client's decision against AC-14.

### GAP-06: Hosted release and production hardening are not established by local QA

The merged [backend release-readiness report](testing/backend-release-readiness.md) records cold-start D1 query-budget limits, dependency/security follow-up, demonstration-only authentication, concurrent-editing limits and remaining error/transaction hardening. Its dated dependency audit is evidence of follow-up work, not a current audit or a production sign-off. The local synthetic-data checks and #67 QA completion do not verify hosted deployment or approve real organisational data use.

**Recommended follow-up:** Carry these conditions into the team's deployment/security and handover work. Confirm the hosting plan, initialisation strategy, dependency review and access controls before claiming a production-ready release. This verification does not implement those changes.

## Automated Verification Results

### Final team QA evidence

[Issue #67](https://github.com/Roshss2508/CITS_5206_Proj11_Capstone/issues/67) tracks the final UI, responsive-layout and cross-browser regression work. The project owner's latest review comment on [Issue #46](https://github.com/Roshss2508/CITS_5206_Proj11_Capstone/issues/46) reports that #67 is complete, with **116 passing Playwright executions across Chrome and Edge** and no identified demonstration-blocking regressions. The merged UI/responsive changes are in PR #65 and reviewer approval/Changes Required coverage is in PR #72. This team conclusion is limited to the tested demonstration workflow; it does not resolve GAP-01 to GAP-06 or establish client UAT or hosted readiness.

### Independent integrated-main verification

The final check uses an isolated checkout containing integrated `main` commit `09dedb1` and this documentation update. Checks use synthetic fixtures and a local D1 database. Results below are from 14 October 2026; the earlier 9 October results (80 unit tests and 84 Playwright executions) are superseded for this baseline.

| Check | Result |
|---|---|
| `npm run lint` | Passed |
| `npm run typecheck` | Passed |
| `npm run test` | Passed: 12 files, 157 tests |
| `npm run build` | Passed |
| `npm run test:e2e -- --workers=4` | Passed: 116 Playwright executions across Chrome and Edge; no retries, failures or skipped tests |

The browser suite covers dashboard and business-rule navigation, Steps 1-5, validation and empty states, atomic/batched Step 2 persistence, maximum-size plan saves and duplication, unchanged-save protection, PDF/CSV snapshot consistency, historical snapshot selection, audit-history navigation, capability integrity, restore behaviour, snapshot freshness, submission protection, Reviewer approval/Changes Required, read-only cases, role persistence and autosave reliability.

All AC-01 to AC-14 statuses were checked again against the final integrated baseline. No status change is justified by the merged QA/persistence work: AC-06 and AC-12 remain partially satisfied, AC-10 remains not yet satisfied, and AC-14 remains pending clarification. The other ten criteria retain their satisfied status. The merged Issue #45 documentation in PR #66 is now the traceability reference; it is no longer an unmerged dependency. Further main-branch changes require a new baseline check rather than being assumed covered by these results.
