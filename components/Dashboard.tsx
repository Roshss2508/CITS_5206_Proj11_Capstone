"use client";

import { useEffect, useState } from "react";
import { Archive, ArrowRight, Copy, FilePlus2, LoaderCircle, Plus, ShieldCheck } from "lucide-react";
import { apiRequest, useDemoRole } from "@/src/client/api";
import type { CostingCase, CostingCaseAggregate } from "@/src/modules/types";
import { DemoRoleToggle } from "@/components/DemoRoleToggle";
import { ProductSidebar } from "@/components/ProductSidebar";

const statusLabel: Record<CostingCase["status"], string> = {
  DRAFT: "Draft",
  READY_FOR_REVIEW: "Ready for review",
  APPROVED: "Approved",
  ARCHIVED: "Archived",
};

export function Dashboard() {
  const [role, setRole] = useDemoRole();
  const [cases, setCases] = useState<CostingCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [platformName, setPlatformName] = useState("Synthetic Imaging Platform");
  const [pricingPeriod, setPricingPeriod] = useState("2027–2029");
  const [error, setError] = useState("");

  const loadCases = async () => {
    try {
      const response = await apiRequest<{ cases: CostingCase[] }>("/api/v1/cases", role);
      setCases(response.cases);
      setError("");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to load cases."); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    let cancelled = false;
    apiRequest<{ cases: CostingCase[] }>("/api/v1/cases", role)
      .then((response) => { if (!cancelled) { setCases(response.cases); setError(""); } })
      .catch((caught) => { if (!cancelled) setError(caught instanceof Error ? caught.message : "Unable to load cases."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [role]);

  const createCase = async () => {
    try {
      const response = await apiRequest<{ case: CostingCaseAggregate }>("/api/v1/cases", role, { method: "POST", body: JSON.stringify({ platformName, pricingPeriod }) });
      window.location.href = `/cases/${response.case.costingCase.id}`;
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to create the case."); }
  };

  const duplicate = async (id: string) => {
    try {
      await apiRequest(`/api/v1/cases/${id}/duplicate`, role, { method: "POST" });
      await loadCases();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to duplicate the case."); }
  };

  const archive = async (id: string) => {
    try {
      await apiRequest(`/api/v1/cases/${id}/status`, role, { method: "POST", body: JSON.stringify({ status: "ARCHIVED", comment: "Archived from the case dashboard." }) });
      await loadCases();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to archive the case."); }
  };

  return (
    <main className="product-shell">
      <ProductSidebar />
      <section className="product-main">
        <header className="dashboard-header">
          <div><p className="page-kicker">COSTING CASES</p><h1>Transparent pricing starts with a defensible case.</h1><p>Capture evidence, calculate sustainable rates and keep every decision linked to an immutable snapshot.</p></div>
          <div className="header-actions"><DemoRoleToggle role={role} onChange={setRole} />{role === "EDITOR" && <button className="button primary" onClick={() => setShowCreate(true)} type="button"><Plus size={18} /> New costing case</button>}</div>
        </header>

        <section className="formula-banner" id="business-rules">
          <span className="formula-icon"><ShieldCheck size={19} /></span>
          <div><strong>RIC Formula V1 is active</strong><small>35% external indirect-cost recovery · GST exclusive · Decimal-safe calculations</small></div>
          <span className="pill green">VERIFIED</span>
        </section>

        {error && <div className="notice error" role="alert">{error}</div>}
        {showCreate && (
          <section className="create-panel">
            <div><p className="page-kicker">NEW CASE</p><h2>Start with the pricing context</h2></div>
            <label>Platform name<input value={platformName} onChange={(event) => setPlatformName(event.target.value)} /></label>
            <label>Pricing period<input value={pricingPeriod} onChange={(event) => setPricingPeriod(event.target.value)} /></label>
            <div className="button-row"><button className="button ghost" onClick={() => setShowCreate(false)} type="button">Cancel</button><button className="button primary" onClick={createCase} type="button"><FilePlus2 size={17} /> Create case</button></div>
          </section>
        )}

        <section className="section-block">
          <div className="section-title"><div><p className="page-kicker">WORKSPACE</p><h2>Active costing cases</h2></div><span>{cases.filter((item) => item.status !== "ARCHIVED").length} active</span></div>
          {loading ? <div className="empty-state"><LoaderCircle className="spin" /> Loading cases…</div> : cases.length === 0 ? (
            <div className="empty-state"><FilePlus2 size={30} /><h3>No costing cases yet</h3><p>Create the first synthetic case to test the complete workflow.</p></div>
          ) : (
            <div className="case-grid">
              {cases.map((item) => (
                <article className={`case-card ${item.status === "ARCHIVED" ? "archived" : ""}`} key={item.id}>
                  <div className="case-card-top"><span className={`pill status-${item.status.toLowerCase()}`}>{statusLabel[item.status]}</span><span className="case-step">Step {item.currentStep}/5</span></div>
                  <h3>{item.platformName}</h3><p>{item.pricingPeriod}</p>
                  <div className="case-meta"><span>Formula</span><strong>{item.formulaVersion.replace("RIC_", "RIC ")}</strong><span>Updated</span><strong>{new Date(item.updatedAt).toLocaleDateString("en-AU")}</strong></div>
                  <div className="case-actions">
                    <a className="button primary compact" href={`/cases/${item.id}`}>Open case <ArrowRight size={16} /></a>
                    {role === "EDITOR" && item.status !== "ARCHIVED" && <button aria-label="Duplicate case" className="icon-button" onClick={() => duplicate(item.id)} title="Duplicate" type="button"><Copy size={17} /></button>}
                    {role === "EDITOR" && item.status !== "ARCHIVED" && <button aria-label="Archive case" className="icon-button" onClick={() => archive(item.id)} title="Archive" type="button"><Archive size={17} /></button>}
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
