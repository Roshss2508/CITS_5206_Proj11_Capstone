"use client";

import { useSearchParams } from "next/navigation";
import { AlertTriangle, ArrowLeft, ShieldCheck } from "lucide-react";
import { ProductSidebar } from "@/components/ProductSidebar";

// Rule content mirrors docs/business-rules.md; keep the two in sync. Wording here
// must stay aligned with docs/business-rule-analysis.md — these rules are implemented
// and tested, not necessarily client-confirmed, and the analysis doc is the source of
// truth for confirmation status.
const currentRules = [
  { id: "RATE-UWA-001", rule: "(cost − UWA support − non-UWA support) ÷ forecast units, floored at zero.", evidence: "Golden test" },
  { id: "RATE-APFR-001", rule: "((cost − non-UWA support) ÷ forecast units) × 1.35, floored at zero before the multiplier.", evidence: "Golden test" },
  { id: "RATE-COM-001", rule: "(cost ÷ forecast units) × 1.35; UWA support cannot reduce this rate.", evidence: "Golden + independence test" },
  { id: "CAPACITY-001", rule: "Forecast units = maximum realistic capacity × forecast utilisation percentage.", evidence: "Zero-unit validation test" },
  { id: "COST-ALLOC-001", rule: "Platform costs are split equally across active capabilities; direct costs stay with their capability.", evidence: "Multi-capability test" },
  { id: "INCOME-ALLOC-001", rule: "UWA and non-UWA recurrent support are split equally across active capabilities.", evidence: "Golden test" },
  { id: "SHARE-001", rule: "UWA, APFR and Commercial forecast user shares must total exactly 100%.", evidence: "Validation test" },
  { id: "OVERHEAD-001", rule: "External proposed-rate revenue exposes the 35/135 overhead portion separately from net platform recovery.", evidence: "Calculation result" },
  { id: "GST-001", rule: "All calculations are GST exclusive; GST may be shown separately but never supports facility operations.", evidence: "Report wording" },
  { id: "SNAPSHOT-001", rule: "Calculation snapshots are append-only and retain input, output, actor, time and formula version.", evidence: "Repository/API design" },
];

const pendingRules = [
  "Whether recurrent operating support should be allocated equally or by a capability-specific weighting in future versions.",
  "Whether the platform retains any part of the 35% external indirect-cost recovery.",
  "Formal UWA terminology for APFR versus PFRI in reports.",
  "Whether benchmark data must be saved as a required record with every costing case, or is only used as review context.",
  "What exact fields the PDF and CSV exports must contain to satisfy approval and communication requirements.",
];

function resolveBackTarget(from: string | null): { href: string; label: string } {
  if (from && /^\/cases\/[A-Za-z0-9-]+$/.test(from)) return { href: from, label: "Back to costing case" };
  return { href: "/", label: "Back to costing cases" };
}

export function BusinessRules() {
  const back = resolveBackTarget(useSearchParams().get("from"));

  return (
    <main className="product-shell">
      <ProductSidebar active="rules" />
      <section className="product-main wizard-main">
        <header className="wizard-header">
          <div className="wizard-title">
            <a href={back.href}><ArrowLeft size={17} /> {back.label}</a>
            <p className="page-kicker">BUSINESS RULES</p>
            <h1>RIC Formula V1 business rules</h1>
          </div>
        </header>

        <section className="formula-banner">
          <span className="formula-icon"><ShieldCheck size={19} /></span>
          <div><strong>RIC Formula V1 is active</strong><small>35% external indirect-cost recovery · GST exclusive · Decimal-safe calculations</small></div>
          <span className="pill green">TESTED</span>
        </section>

        <section className="wizard-panel">
          <div className="panel-intro">
            <p className="page-kicker">CURRENT IMPLEMENTATION</p>
            <h2>Rules applied to every calculation</h2>
            <p>These rules are currently implemented and tested, and are used for every costing case on RIC Formula V1. Some implementation details still require client confirmation — see docs/business-rule-analysis.md for the areas still open.</p>
          </div>
          <table className="rules-table">
            <thead><tr><th>Rule ID</th><th>Rule</th><th>Automated evidence</th></tr></thead>
            <tbody>
              {currentRules.map((item) => <tr key={item.id}><td>{item.id}</td><td>{item.rule}</td><td>{item.evidence}</td></tr>)}
            </tbody>
          </table>
          <p className="rules-precision-note">SQLite stores financial values as decimal strings and <code>decimal.js</code> performs every authoritative calculation. Intermediate results are not rounded — currency is rounded half-up to two decimal places and quantities to six decimal places for presentation only.</p>

          <div className="pending-rules">
            <h3><AlertTriangle size={16} /> Awaiting client confirmation</h3>
            <p>The items below are open questions raised with the client. Some related behaviour is already implemented on a provisional basis, but none of it is final or client-approved — do not treat it as a confirmed business rule. Any resolution will ship as a new formula version; existing calculation snapshots are never changed retroactively.</p>
            <ul>{pendingRules.map((item) => <li key={item}>{item}</li>)}</ul>
          </div>
        </section>
      </section>
    </main>
  );
}
