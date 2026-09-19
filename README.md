# Capstone Project - Research Infrastructure Costing Tool

## Overview

This repository contains the Software Engineering Capstone project for developing a prototype of the **Research Infrastructure Costing and Pricing Decision-Support Tool** for the UWA Office of Research.

The project aims to transform the existing Excel-based costing and pricing methodology into a guided digital application that is easier to use, maintain, and update while preserving the existing costing and pricing logic.

---

## Project Objectives

The objectives of this project are to:

- Translate the existing Excel-based costing framework into a guided digital application.
- Preserve the existing costing and pricing methodology.
- Validate required user inputs.
- Reduce the risk of spreadsheet errors.
- Produce consistent costing calculations.
- Generate structured reports to support planning and decision-making.

---

## Core Features

The application will support:

- Cost assumptions
- Utilisation assumptions
- Pricing assumptions
- Operational information
- Infrastructure usage data
- Mandatory justification fields for key inputs
- Consistent costing calculations
- Structured reporting
- Pricing scenario modelling
- Decision-support capabilities

---

## Team Members

| Member | Official Team Roles | Project Responsibilities |
|--------|---------------------|--------------------------|
| **Roshan** | Facilitator, Reporter, Timekeeper | Project Management, Client Communication, Documentation, Development Support, Testing Support |
| **Lucas** | Recorder, Harmonizer | Business Analysis, Requirements Gathering, Meeting Minutes, Documentation, Testing, Development Support |
| **Dylan** | Prioritizer, Checker | Full-Stack Development, Code Review, Technical Support |
| **Ryan** | Innovator, Explorer, Devil's Advocate | Backend Development, Database Design, System Architecture, Technical Guidance |
| **Raega** | Runner, Wildcard | Frontend Development, UI/UX Design, Quality Assurance (QA), Deployment Support |

---

## Project Status

🚧 **Current Phase:** Development, Validation & Client Confirmation

Current activities:

- Developing and validating the current functional prototype
- Reviewing business rules against client-provided documents
- Validating calculations against the existing RIC Cost Calculator
- Improving frontend validation and user workflow
- Conducting QA and end-to-end testing
- Managing development through GitHub Issues and Pull Requests
- Awaiting formal client confirmation of the proposed MVP scope
- Preparing for future standalone staging deployment
---

## Client Information

**Client:** Erika Slavin  
**Organisation:** UWA Office of Research  
**Location:** Crawley Campus

---

## License

This repository is intended for educational purposes as part of the Software Engineering Capstone Project at The University of Western Australia.

---

## Research Infrastructure Costing & Pricing Tool

A functional prototype designed to explore and validate a guided digital costing and pricing workflow for UWA Research Infrastructure custodians.

The current prototype is based on the project brief, client-provided materials and the existing RIC Cost Calculator. The proposed MVP scope is currently awaiting formal client confirmation.

## Current Prototype Implementation
The following functionality currently exists in the prototype. Some workflow features remain subject to client confirmation before being treated as final MVP requirements.

- Durable costing cases with a five-step guided workflow.
- Dynamic management of 1–20 capabilities and hour/day/sample billing units.
- Capability-level and equally allocated platform-level costs.
- UWA and non-UWA recurrent operating support.
- Versioned `RIC_FORMULA_V1` calculation engine using decimal arithmetic.
- Proposed-rate scenarios with UWA/APFR/Commercial user mix.
- Prototype support for calculation snapshots, audit events and role-based review status; final workflow requirements remain subject to client confirmation.
- PDF and CSV exports generated from the latest snapshot.
- Demo Editor and Reviewer roles for workflow exploration; final user roles and UWA authentication requirements remain subject to client confirmation.
- D1/SQLite relational persistence for the hosted student demonstration.

Only synthetic or anonymised data may be used in the public demonstration environment.

## Local development

Prerequisite: Node.js 24 LTS.

```bash
npm ci
npm run dev
```

Open `http://localhost:3000`. The local Sites runtime provides a project-local D1 database and creates the required tables on first use.

## Quality commands

```bash
npm run lint
npm run typecheck
npm run test
npm run build
npm run test:e2e
```

`npm run ci` runs the fast local quality checks. The GitHub `quality` workflow also installs Chromium and runs the Playwright browser suite before a Pull Request can merge. Formula changes must include a Rule ID and a Golden Test.

## Architecture

The application is a modular monolith:

```text
Wizard UI → versioned API → application repository → D1 relational database
                     ↘ RIC calculation engine → immutable snapshot → PDF/CSV
```

Important boundaries:

- UI components never contain authoritative business formulae.
- Every write is validated server-side.
- Monetary API values are decimal strings, never JSON floating-point numbers.
- A snapshot is append-only and remains tied to its formula version.
- Demo authentication is isolated behind role helpers so UWA SSO can replace it later.

See `docs/architecture.md`, `docs/business-rules.md` and `docs/api.md` for implementation details.

## Deployment and data handling

The current prototype is hosted as a student demonstration environment and uses a logical D1 database binding named `DB`.

Only synthetic or anonymised data should be used in the current demonstration environment.

The team plans to evaluate a standalone staging deployment before any production use. UWA approval will be required before decisions are finalised regarding production hosting, identity and access management, data retention, backups, recovery, and use of real organisational data.

## Definition of done

A feature is complete when:

- the relevant GitHub Issue acceptance criteria are satisfied;
- required server-side validation is implemented;
- appropriate empty and error states are provided;
- relevant controls are keyboard-accessible;
- automated tests are included where applicable;
- code changes are reviewed through a non-author Pull Request review; and
- any unresolved client-dependent requirements are documented rather than assumed.


## Team Working Agreement

To keep the project organised and ensure fair contribution from all members, the team follows the working agreements below.

### 1. Communication

- Team members should acknowledge important Teams/GitHub messages within **24 hours on weekdays** where reasonably possible.
- If a response is required, the message should clearly state the response deadline.
- For routine/non-critical team decisions, if a member does not respond by the stated deadline after a reasonable reminder, the team may proceed based on the responses received.
- Silence will **not** be treated as approval for major technical decisions, business-rule changes, MVP scope changes, or client-dependent requirements.

### 2. Assigned Tasks

- Every assigned task should have a clear GitHub Issue, owner, scope, and acceptance criteria.
- Members are responsible for checking their assigned issues and progressing them within the agreed timeframe.
- If a member cannot complete a task on time, they should inform the team as early as possible and explain any blocker.
- Blockers should be reported before the deadline rather than after the task becomes overdue.
- Tasks requiring client confirmation must not be implemented by assumption.

### 3. Weekly Accountability

- Weekly accountability records will reflect **actual work completed or meaningful progress made during that week**.
- Being assigned a task alone does not count as a completed contribution.
- Members should provide enough evidence of their contribution before the weekly accountability document is prepared.
- If no work or progress is recorded for a member during the week, their contribution section may remain blank or state that no contribution was recorded.
- A member will not be penalised for a genuine documented blocker that was communicated to the team in advance.

### 4. GitHub Workflow

- Development work should begin from an assigned GitHub Issue.
- Code changes should be made on a separate branch rather than directly on `main`.
- Code/test changes should normally be submitted through a Pull Request.
- Pull Requests should link the relevant Issue and explain the changes and testing performed.
- At least one non-author team member should review a Pull Request before merge.
- Review comments should be resolved or discussed before approval.
- Documentation/research/testing tasks that do not modify repository files do not require a Pull Request, but completion evidence should be added to the Issue.

### 5. Pull Request Reviews

- Reviewers should check the Pull Request against the Issue acceptance criteria rather than approving only because automated tests pass.
- Bugs, edge cases, or unclear behaviour identified during review should be raised constructively.
- If changes are requested, the author should respond and update the PR before approval.
- Significant new requirements discovered during review should be created as separate Issues rather than silently added to the current task.

### 6. Meetings

- Members should attend scheduled team/facilitator meetings where possible.
- If unable to attend, the member should notify the team in advance.
- Important decisions and action items from meetings should be recorded.
- Tasks arising from meetings should be assigned clearly with an owner and expected timeframe.

### 7. Client-Dependent Decisions

- Requirements that still need confirmation from the client should be marked as **Pending Client Confirmation**.
- The team may continue with confirmed requirements, testing, documentation, bug fixes, and technical preparation while waiting for client feedback.
- Client-dependent assumptions should not be treated as final requirements until confirmed.

### 8. Fair Workload and Support

- Roles indicate primary responsibilities but do not prevent members from helping in other areas.
- Members who finish assigned work may be given additional tasks based on project priority and workload.
- Members should ask for help early if they are unfamiliar with an assigned task.
- The team should redistribute work when there is a genuine skills, availability, or workload issue.

### 9. Issue Completion

An Issue should only be closed when:

- the acceptance criteria have been addressed;
- required evidence has been provided;
- relevant tests/checks have passed;
- any required PR has been reviewed and merged; and
- unresolved follow-up work has been recorded in separate Issues.

### 10. Team Concerns

- Concerns about missed work, communication, or workload should first be discussed respectfully within the team.
- Repeated unresolved issues should be documented and raised with the facilitator where necessary.
