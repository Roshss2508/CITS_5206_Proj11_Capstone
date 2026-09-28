"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, ArrowLeft, LoaderCircle } from "lucide-react";
import { apiRequest } from "@/src/client/api";
import { describeError } from "@/src/client/errorMessages";
import type { CostingCaseAggregate } from "@/src/modules/types";
import { AuditHistoryList } from "@/components/AuditHistoryList";
import { ProductSidebar } from "@/components/ProductSidebar";

export function CaseAudit({ caseId }: { caseId: string }) {
  const [aggregate, setAggregate] = useState<CostingCaseAggregate | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    apiRequest<{ case: CostingCaseAggregate }>(`/api/v1/cases/${caseId}`, "EDITOR")
      .then(({ case: data }) => { setAggregate(data); setError(""); })
      .catch((caught) => setError(describeError(caught, "Unable to load this case.")))
      .finally(() => setLoading(false));
  }, [caseId]);

  if (loading) return <main className="loading-screen"><LoaderCircle className="spin" /> Loading audit history…</main>;
  if (!aggregate) return <main className="loading-screen error">{error || "Costing case not found."}</main>;

  return (
    <main className="product-shell">
      <ProductSidebar active="audit" />
      <section className="product-main wizard-main">
        <header className="wizard-header">
          <div className="wizard-title">
            <a href={`/cases/${caseId}`}><ArrowLeft size={17} /> Back to {aggregate.costingCase.platformName}</a>
            <p className="page-kicker">{aggregate.costingCase.pricingPeriod} · AUDIT HISTORY</p>
            <h1>{aggregate.costingCase.platformName}</h1>
          </div>
        </header>

        {error && <div className="notice error" role="alert"><AlertTriangle size={18} /> {error}</div>}

        <section className="wizard-panel">
          <div className="panel-intro">
            <p className="page-kicker">AUDIT TRAIL</p>
            <h2>Every recorded action for this case</h2>
            <p>Status changes and calculations are recorded here, newest first, without storing request payloads.</p>
          </div>
          <AuditHistoryList events={aggregate.auditEvents} />
        </section>
      </section>
    </main>
  );
}
