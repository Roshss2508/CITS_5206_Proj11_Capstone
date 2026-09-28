"use client";

import { useEffect, useState } from "react";
import { ArrowRight, FilePlus2, LoaderCircle } from "lucide-react";
import { apiRequest } from "@/src/client/api";
import type { CostingCase } from "@/src/modules/types";
import { ProductSidebar } from "@/components/ProductSidebar";

const statusLabel: Record<CostingCase["status"], string> = {
  DRAFT: "Draft",
  READY_FOR_REVIEW: "Ready for review",
  APPROVED: "Approved",
  ARCHIVED: "Archived",
};

export function AuditLanding() {
  const [cases, setCases] = useState<CostingCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    apiRequest<{ cases: CostingCase[] }>("/api/v1/cases", "EDITOR")
      .then((response) => { setCases(response.cases); setError(""); })
      .catch((caught) => setError(caught instanceof Error ? caught.message : "Unable to load cases."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="product-shell">
      <ProductSidebar active="audit" />
      <section className="product-main">
        <header className="dashboard-header">
          <div>
            <p className="page-kicker">AUDIT HISTORY</p>
            <h1>Audit history is tracked per costing case.</h1>
            <p>Choose a case below to view its full audit trail.</p>
          </div>
        </header>

        {error && <div className="notice error" role="alert">{error}</div>}

        <section className="section-block">
          <div className="section-title"><div><p className="page-kicker">WORKSPACE</p><h2>Costing cases</h2></div></div>
          {loading ? <div className="empty-state"><LoaderCircle className="spin" /> Loading cases…</div> : cases.length === 0 ? (
            <div className="empty-state"><FilePlus2 size={30} /><h3>No costing cases yet</h3><p>Create a case from the dashboard to start building an audit trail.</p></div>
          ) : (
            <div className="case-grid">
              {cases.map((item) => (
                <article className={`case-card ${item.status === "ARCHIVED" ? "archived" : ""}`} key={item.id}>
                  <div className="case-card-top"><span className={`pill status-${item.status.toLowerCase()}`}>{statusLabel[item.status]}</span><span className="case-step">Step {item.currentStep}/5</span></div>
                  <h3>{item.platformName}</h3><p>{item.pricingPeriod}</p>
                  <div className="case-meta"><span>Formula</span><strong>{item.formulaVersion.replace("RIC_", "RIC ")}</strong><span>Updated</span><strong>{new Date(item.updatedAt).toLocaleDateString("en-AU")}</strong></div>
                  <div className="case-actions">
                    <a className="button primary compact" href={`/cases/${item.id}/audit`}>View audit trail <ArrowRight size={16} /></a>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
