"use client";
/* eslint-disable @next/next/no-html-link-for-pages */

import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle, ArrowLeft, Check, CheckCircle2, ChevronLeft, ChevronRight,
  CircleDollarSign, Download, FileCheck2, FileSpreadsheet, LoaderCircle, Plus, Save,
  Send, ShieldCheck, Trash2,
} from "lucide-react";
import { apiRequest, useDemoRole } from "@/src/client/api";
import type {
  CalculationResult, Capability, CapacityPlan, CostLine, CostingCaseAggregate,
  IncomeLine, ProposedRate,
} from "@/src/modules/types";
import { DemoRoleToggle } from "@/components/DemoRoleToggle";
import { ProductSidebar } from "@/components/ProductSidebar";

const stepLabels = ["Platform & capabilities", "Costs & income", "Capacity & utilisation", "Rates & scenarios", "Review & export"];
const blankId = () => window.crypto.randomUUID();
const unitLabel = { HOUR: "hours", DAY: "days", SAMPLE: "samples" } as const;
const money = (value: string) => Number(value || 0).toLocaleString("en-AU", { style: "currency", currency: "AUD" });

export function CaseWizard({ caseId }: { caseId: string }) {
  const [role, setRole] = useDemoRole();
  const [aggregate, setAggregate] = useState<CostingCaseAggregate | null>(null);
  const [capabilities, setCapabilities] = useState<Capability[]>([]);
  const [costs, setCosts] = useState<CostLine[]>([]);
  const [income, setIncome] = useState<IncomeLine[]>([]);
  const [capacity, setCapacity] = useState<CapacityPlan[]>([]);
  const [rates, setRates] = useState<ProposedRate[]>([]);
  const [result, setResult] = useState<CalculationResult | null>(null);
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [saveState, setSaveState] = useState("All changes saved");
  const [dirtyVersion, setDirtyVersion] = useState(0);
  const loadedRef = useRef(false);

  const hydrate = (data: CostingCaseAggregate) => {
    setAggregate(data);
    setCapabilities(data.capabilities);
    setCosts(data.costs.length ? data.costs : [
      { id: blankId(), caseId, capabilityId: null, category: "STAFFING", scope: "PLATFORM", label: "Platform staffing", amount: "50000", justification: "Synthetic annual staffing allocation used for the MVP demonstration." },
      { id: blankId(), caseId, capabilityId: data.capabilities[0]?.id || null, category: "MAINTENANCE", scope: "CAPABILITY", label: "Annual maintenance", amount: "100000", justification: "Synthetic service-contract estimate based on the reference case." },
    ]);
    setIncome(data.income.length ? data.income : [
      { id: blankId(), caseId, sourceName: "UWA in-kind support", sourceType: "UWA_SUPPORT", amount: "20000", justification: "Synthetic UWA contribution for the reference calculation." },
      { id: blankId(), caseId, sourceName: "WA Government support", sourceType: "NON_UWA_SUPPORT", amount: "30000", justification: "Synthetic recurrent non-UWA operating support." },
    ]);
    setCapacity(data.capabilities.map((item) => data.capacity.find((row) => row.capabilityId === item.id) || {
      id: blankId(), caseId, capabilityId: item.id, maximumCapacity: "1000", forecastUtilisationPct: "100",
      historicYear1: null, historicYear2: null, historicYear3: null,
      justification: "Synthetic forecast based on available capacity and expected demand.",
    }));
    setRates(data.capabilities.map((item) => data.proposedRates.find((row) => row.capabilityId === item.id) || {
      id: blankId(), caseId, capabilityId: item.id, uwaRate: null, apfrRate: null, commercialRate: null,
      uwaSharePct: "60", apfrSharePct: "25", commercialSharePct: "15",
      justification: "Initial scenario uses the calculated sustainable rates and expected user mix.",
    }));
    const latest = data.snapshots[0];
    setResult(latest ? JSON.parse(latest.outputJson) as CalculationResult : null);
    setStep(Math.max(1, Math.min(5, data.costingCase.currentStep)));
  };

  useEffect(() => {
    apiRequest<{ case: CostingCaseAggregate }>(`/api/v1/cases/${caseId}`, role)
      .then(({ case: data }) => { hydrate(data); loadedRef.current = true; setError(""); })
      .catch((caught) => setError(caught instanceof Error ? caught.message : "Unable to load this case."))
      .finally(() => setLoading(false));
  // The aggregate hydrator intentionally owns all related form state.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId, role]);

  const markDirty = () => { setSaveState("Unsaved changes"); setDirtyVersion((value) => value + 1); };

  const request = async <T,>(url: string, body: unknown, method = "PUT") => apiRequest<T>(url, role, { method, body: JSON.stringify(body) });

  const saveStep = async (target = step, silent = false) => {
    if (role !== "EDITOR") return true;
    try {
      if (!silent) setWorking(true);
      setSaveState("Saving…");
      let response: { case: CostingCaseAggregate } | null = null;
      if (target === 1) response = await request(`/api/v1/cases/${caseId}/capabilities`, { capabilities: capabilities.map((item, index) => ({ id: item.id, name: item.name, billableUnit: item.billableUnit, active: item.active, displayOrder: index })) });
      if (target === 2) {
        await request(`/api/v1/cases/${caseId}/costs`, { costs: costs.map((item) => ({ id: item.id, capabilityId: item.capabilityId, category: item.category, scope: item.scope, label: item.label, amount: item.amount, justification: item.justification })) });
        response = await request(`/api/v1/cases/${caseId}/income`, { income: income.map((item) => ({ id: item.id, sourceName: item.sourceName, sourceType: item.sourceType, amount: item.amount, justification: item.justification })) });
      }
      if (target === 3) response = await request(`/api/v1/cases/${caseId}/capacity`, { capacity: capacity.map((item) => ({ id: item.id, capabilityId: item.capabilityId, maximumCapacity: item.maximumCapacity, forecastUtilisationPct: item.forecastUtilisationPct, historicYear1: item.historicYear1, historicYear2: item.historicYear2, historicYear3: item.historicYear3, justification: item.justification })) });
      if (target === 4) response = await request(`/api/v1/cases/${caseId}/proposed-rates`, { proposedRates: rates.map((item) => ({ id: item.id, capabilityId: item.capabilityId, uwaRate: item.uwaRate, apfrRate: item.apfrRate, commercialRate: item.commercialRate, uwaSharePct: item.uwaSharePct, apfrSharePct: item.apfrSharePct, commercialSharePct: item.commercialSharePct, justification: item.justification })) });
      if (response && !silent) hydrate(response.case);
      setSaveState("All changes saved");
      setError("");
      return true;
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Unable to save this step.";
      setSaveState(silent ? "Complete required fields to save" : "Save failed");
      if (!silent) setError(message);
      return false;
    } finally { if (!silent) setWorking(false); }
  };

  useEffect(() => {
    if (!loadedRef.current || dirtyVersion === 0 || role !== "EDITOR") return;
    const timer = window.setTimeout(() => { void saveStep(step, true); }, 1400);
    return () => window.clearTimeout(timer);
  // Autosave is intentionally keyed only by explicit form mutations.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirtyVersion, role, step]);

  const goTo = async (next: number) => {
    if (next > step && !(await saveStep(step))) return;
    setStep(Math.max(1, Math.min(5, next)));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const addCapability = () => {
    if (capabilities.length >= 20) return;
    const id = blankId();
    setCapabilities((items) => [...items, { id, caseId, name: `Capability ${items.length + 1}`, billableUnit: "HOUR", active: true, displayOrder: items.length }]);
    setCapacity((items) => [...items, { id: blankId(), caseId, capabilityId: id, maximumCapacity: "1000", forecastUtilisationPct: "50", historicYear1: null, historicYear2: null, historicYear3: null, justification: "Forecast based on available capacity and expected demand." }]);
    setRates((items) => [...items, { id: blankId(), caseId, capabilityId: id, uwaRate: null, apfrRate: null, commercialRate: null, uwaSharePct: "60", apfrSharePct: "25", commercialSharePct: "15", justification: "Initial scenario uses the sustainable rates." }]);
    markDirty();
  };

  const calculate = async () => {
    if (!(await saveStep(4))) return;
    try {
      setWorking(true);
      const response = await apiRequest<{ result: CalculationResult }>(`/api/v1/cases/${caseId}/calculate`, role, { method: "POST" });
      setResult(response.result);
      const refreshed = await apiRequest<{ case: CostingCaseAggregate }>(`/api/v1/cases/${caseId}`, role);
      setAggregate(refreshed.case);
      setSaveState("Calculation snapshot saved");
      setError("");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to calculate rates."); }
    finally { setWorking(false); }
  };

  const changeStatus = async (status: string) => {
    try {
      setWorking(true);
      const response = await request<{ case: CostingCaseAggregate }>(`/api/v1/cases/${caseId}/status`, { status, comment: status === "APPROVED" ? "Approved after review of the immutable calculation snapshot." : status === "DRAFT" ? "Returned for changes after review." : "Submitted for client review." }, "POST");
      hydrate(response.case);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to change case status."); }
    finally { setWorking(false); }
  };

  if (loading) return <main className="loading-screen"><LoaderCircle className="spin" /> Loading the costing case…</main>;
  if (!aggregate) return <main className="loading-screen error">{error || "Costing case not found."}</main>;
  const readOnly = role === "REVIEWER" || aggregate.costingCase.status === "APPROVED" || aggregate.costingCase.status === "ARCHIVED";

  return (
    <main className="product-shell">
      <ProductSidebar />
      <section className="product-main wizard-main">
        <header className="wizard-header">
          <div className="wizard-title"><a href="/"><ArrowLeft size={17} /> All cases</a><p className="page-kicker">{aggregate.costingCase.pricingPeriod} · {aggregate.costingCase.formulaVersion.replaceAll("_", " ")}</p><h1>{aggregate.costingCase.platformName}</h1></div>
          <div className="header-actions"><div className={`save-state ${saveState.includes("failed") ? "bad" : ""}`}><Save size={14} /> {saveState}</div><DemoRoleToggle role={role} onChange={setRole} /></div>
        </header>

        <div className="wizard-status-row">
          <span className={`pill status-${aggregate.costingCase.status.toLowerCase()}`}>{aggregate.costingCase.status.replaceAll("_", " ")}</span>
          {readOnly && <span className="readonly-note"><ShieldCheck size={15} /> Read-only in this role or status</span>}
        </div>

        <ol className="stepper" aria-label="Costing workflow">
          {stepLabels.map((label, index) => {
            const number = index + 1; const complete = number < step;
            return <li className={number === step ? "current" : complete ? "complete" : ""} key={label}><button onClick={() => void goTo(number)} type="button"><span>{complete ? <Check size={15} /> : number}</span><strong>{label}</strong></button></li>;
          })}
        </ol>

        {error && <div className="notice error" role="alert"><AlertTriangle size={18} /> {error}</div>}

        <section className="wizard-panel">
          {step === 1 && <StepCapabilities items={capabilities} readOnly={readOnly} onAdd={addCapability} onChange={(items) => { setCapabilities(items); markDirty(); }} />}
          {step === 2 && <StepCostsIncome capabilities={capabilities} costs={costs} income={income} readOnly={readOnly} onCosts={(items) => { setCosts(items); markDirty(); }} onIncome={(items) => { setIncome(items); markDirty(); }} />}
          {step === 3 && <StepCapacity capabilities={capabilities} items={capacity} readOnly={readOnly} onChange={(items) => { setCapacity(items); markDirty(); }} />}
          {step === 4 && <StepRates capabilities={capabilities} items={rates} result={result} readOnly={readOnly} working={working} onChange={(items) => { setRates(items); markDirty(); }} onCalculate={() => void calculate()} />}
          {step === 5 && <StepReview aggregate={aggregate} result={result} role={role} working={working} onStatus={changeStatus} />}
        </section>

        <footer className="wizard-footer">
          <button className="button ghost" disabled={step === 1 || working} onClick={() => void goTo(step - 1)} type="button"><ChevronLeft size={17} /> Back</button>
          <span>Step {step} of 5</span>
          {step < 5 ? <button className="button primary" disabled={working || (readOnly && step === 5)} onClick={() => void goTo(step + 1)} type="button">Save & continue <ChevronRight size={17} /></button> : <a className="button ghost" href="/">Finish <CheckCircle2 size={17} /></a>}
        </footer>
      </section>
    </main>
  );
}

function SectionIntro({ kicker, title, copy }: { kicker: string; title: string; copy: string }) {
  return <div className="panel-intro"><p className="page-kicker">{kicker}</p><h2>{title}</h2><p>{copy}</p></div>;
}

function StepCapabilities({ items, readOnly, onAdd, onChange }: { items: Capability[]; readOnly: boolean; onAdd: () => void; onChange: (items: Capability[]) => void }) {
  const update = (index: number, patch: Partial<Capability>) => onChange(items.map((item, i) => i === index ? { ...item, ...patch } : item));
  return <>
    <SectionIntro kicker="STEP 1" title="Define the platform and its billable capabilities" copy="A capability can be an instrument, a coordinated group of instruments or a specialist service. Use one consistent billable unit per capability." />
    <div className="stack-list">{items.map((item, index) => <article className="form-card" key={item.id}><div className="form-card-number">{index + 1}</div><label className="grow">Capability name<input disabled={readOnly} value={item.name} onChange={(event) => update(index, { name: event.target.value })} /></label><label>Billable unit<select disabled={readOnly} value={item.billableUnit} onChange={(event) => update(index, { billableUnit: event.target.value as Capability["billableUnit"] })}><option value="HOUR">Hour</option><option value="DAY">Day</option><option value="SAMPLE">Sample</option></select></label>{!readOnly && items.length > 1 && <button aria-label={`Remove ${item.name}`} className="icon-button danger" onClick={() => onChange(items.filter((_, i) => i !== index))} type="button"><Trash2 size={17} /></button>}</article>)}</div>
    {!readOnly && <button className="button secondary" disabled={items.length >= 20} onClick={onAdd} type="button"><Plus size={17} /> Add capability</button>}
    <div className="guidance-box"><strong>Boundary for RIC Formula V1</strong><span>Platform-level costs and operating support are allocated equally across active capabilities. Direct costs stay with the selected capability.</span></div>
  </>;
}

function StepCostsIncome({ capabilities, costs, income, readOnly, onCosts, onIncome }: { capabilities: Capability[]; costs: CostLine[]; income: IncomeLine[]; readOnly: boolean; onCosts: (items: CostLine[]) => void; onIncome: (items: IncomeLine[]) => void }) {
  const updateCost = (index: number, patch: Partial<CostLine>) => onCosts(costs.map((item, i) => i === index ? { ...item, ...patch } : item));
  const updateIncome = (index: number, patch: Partial<IncomeLine>) => onIncome(income.map((item, i) => i === index ? { ...item, ...patch } : item));
  return <>
    <SectionIntro kicker="STEP 2" title="Capture full operating costs and recurrent support" copy="Record every annual cost needed to operate the service. User fees are deliberately excluded from non-variable operating income." />
    <div className="subsection-heading"><div><h3>Operating costs</h3><p>Amounts are annual and GST exclusive.</p></div>{!readOnly && <button className="button secondary compact" onClick={() => onCosts([...costs, { id: blankId(), caseId: capabilities[0].caseId, capabilityId: capabilities[0].id, category: "OTHER", scope: "CAPABILITY", label: "New cost", amount: "0", justification: "Explain the evidence for this annual cost." }])} type="button"><Plus size={16} /> Add cost</button>}</div>
    <div className="line-table"><div className="line-header"><span>Cost / category</span><span>Scope</span><span>Annual amount</span><span>Evidence and justification</span><span /></div>{costs.map((item, index) => <div className="line-row" key={item.id}><div><input aria-label="Cost label" disabled={readOnly} value={item.label} onChange={(event) => updateCost(index, { label: event.target.value })} /><select aria-label="Cost category" disabled={readOnly} value={item.category} onChange={(event) => updateCost(index, { category: event.target.value as CostLine["category"] })}><option value="STAFFING">Staffing</option><option value="MAINTENANCE">Maintenance</option><option value="MATERIALS">Materials</option><option value="SOFTWARE">Software</option><option value="UTILITIES">Utilities</option><option value="COMPLIANCE">Compliance</option><option value="REPLACEMENT_RESERVE">Replacement reserve</option><option value="OTHER">Other</option></select></div><div><select aria-label="Cost scope" disabled={readOnly} value={item.scope === "PLATFORM" ? "PLATFORM" : item.capabilityId || capabilities[0].id} onChange={(event) => updateCost(index, event.target.value === "PLATFORM" ? { scope: "PLATFORM", capabilityId: null } : { scope: "CAPABILITY", capabilityId: event.target.value })}><option value="PLATFORM">Whole platform</option>{capabilities.map((capability) => <option key={capability.id} value={capability.id}>{capability.name}</option>)}</select></div><label className="money-input"><span>$</span><input aria-label="Annual amount" disabled={readOnly} inputMode="decimal" value={item.amount} onChange={(event) => updateCost(index, { amount: event.target.value })} /></label><textarea aria-label="Cost justification" disabled={readOnly} value={item.justification} onChange={(event) => updateCost(index, { justification: event.target.value })} />{!readOnly && <button aria-label={`Remove ${item.label}`} className="icon-button danger" onClick={() => onCosts(costs.filter((_, i) => i !== index))} type="button"><Trash2 size={16} /></button>}</div>)}</div>

    <div className="subsection-heading separated"><div><h3>Non-variable operating income</h3><p>Recurrent support only — never include user fees.</p></div>{!readOnly && <button className="button secondary compact" onClick={() => onIncome([...income, { id: blankId(), caseId: capabilities[0].caseId, sourceName: "New support source", sourceType: "UWA_SUPPORT", amount: "0", justification: "Explain why this support is expected to recur." }])} type="button"><Plus size={16} /> Add income</button>}</div>
    <div className="line-table income"><div className="line-header"><span>Source</span><span>Classification</span><span>Annual amount</span><span>Evidence and justification</span><span /></div>{income.map((item, index) => <div className="line-row" key={item.id}><input aria-label="Income source" disabled={readOnly} value={item.sourceName} onChange={(event) => updateIncome(index, { sourceName: event.target.value })} /><select aria-label="Income classification" disabled={readOnly} value={item.sourceType} onChange={(event) => updateIncome(index, { sourceType: event.target.value as IncomeLine["sourceType"] })}><option value="UWA_SUPPORT">UWA support</option><option value="NON_UWA_SUPPORT">Non-UWA support</option></select><label className="money-input"><span>$</span><input aria-label="Annual income amount" disabled={readOnly} inputMode="decimal" value={item.amount} onChange={(event) => updateIncome(index, { amount: event.target.value })} /></label><textarea aria-label="Income justification" disabled={readOnly} value={item.justification} onChange={(event) => updateIncome(index, { justification: event.target.value })} />{!readOnly && <button aria-label={`Remove ${item.sourceName}`} className="icon-button danger" onClick={() => onIncome(income.filter((_, i) => i !== index))} type="button"><Trash2 size={16} /></button>}</div>)}</div>
  </>;
}

function StepCapacity({ capabilities, items, readOnly, onChange }: { capabilities: Capability[]; items: CapacityPlan[]; readOnly: boolean; onChange: (items: CapacityPlan[]) => void }) {
  const update = (index: number, patch: Partial<CapacityPlan>) => onChange(items.map((item, i) => i === index ? { ...item, ...patch } : item));
  return <>
    <SectionIntro kicker="STEP 3" title="Set realistic capacity and forecast utilisation" copy="Maximum capacity should account for downtime, staff availability, setup and compliance. Forecast use must be justified against historic demand." />
    <div className="capacity-grid">{capabilities.map((capability, index) => { const item = items.find((row) => row.capabilityId === capability.id) || items[index]; const forecast = (Number(item?.maximumCapacity || 0) * Number(item?.forecastUtilisationPct || 0) / 100).toLocaleString("en-AU", { maximumFractionDigits: 2 }); return <article className="capacity-card" key={capability.id}><div className="capacity-title"><div><p className="page-kicker">{unitLabel[capability.billableUnit].toUpperCase()}</p><h3>{capability.name}</h3></div><div className="forecast-chip"><span>Forecast units</span><strong>{forecast}</strong></div></div><div className="form-grid two"><label>Maximum realistic capacity<input disabled={readOnly} inputMode="decimal" value={item?.maximumCapacity || ""} onChange={(event) => update(index, { maximumCapacity: event.target.value })} /></label><label>Forecast utilisation (%)<input disabled={readOnly} inputMode="decimal" max="100" value={item?.forecastUtilisationPct || ""} onChange={(event) => update(index, { forecastUtilisationPct: event.target.value })} /></label></div><div className="form-grid three"><label>Historic year 1<input disabled={readOnly} inputMode="decimal" value={item?.historicYear1 || ""} onChange={(event) => update(index, { historicYear1: event.target.value || null })} /></label><label>Historic year 2<input disabled={readOnly} inputMode="decimal" value={item?.historicYear2 || ""} onChange={(event) => update(index, { historicYear2: event.target.value || null })} /></label><label>Historic year 3<input disabled={readOnly} inputMode="decimal" value={item?.historicYear3 || ""} onChange={(event) => update(index, { historicYear3: event.target.value || null })} /></label></div><label>Forecast justification<textarea disabled={readOnly} value={item?.justification || ""} onChange={(event) => update(index, { justification: event.target.value })} /></label></article>; })}</div>
    <div className="guidance-box"><strong>Planning reference</strong><span>A standard UWA working year is approximately 230 days or 1,725 hours before operational constraints. Use a lower maximum where staffing, maintenance or compliance limits access.</span></div>
  </>;
}

function StepRates({ capabilities, items, result, readOnly, working, onChange, onCalculate }: { capabilities: Capability[]; items: ProposedRate[]; result: CalculationResult | null; readOnly: boolean; working: boolean; onChange: (items: ProposedRate[]) => void; onCalculate: () => void }) {
  const update = (index: number, patch: Partial<ProposedRate>) => onChange(items.map((item, i) => i === index ? { ...item, ...patch } : item));
  return <>
    <SectionIntro kicker="STEP 4" title="Compare sustainable rates with a practical pricing scenario" copy="Leave a proposed rate blank to use the calculated minimum. Adjust rates and user mix to understand the effect on annual platform recovery." />
    {!result ? <div className="calculation-empty"><CircleDollarSign size={34} /><h3>Run the first calculation</h3><p>The engine will validate every input and save an immutable RIC Formula V1 snapshot.</p>{!readOnly && <button className="button primary" disabled={working} onClick={onCalculate} type="button">{working ? <LoaderCircle className="spin" size={17} /> : <CircleDollarSign size={17} />} Calculate sustainable rates</button>}</div> : <FinancialSummary result={result} />}
    <div className="rates-stack">{capabilities.map((capability, index) => { const item = items.find((row) => row.capabilityId === capability.id) || items[index]; const calculated = result?.capabilities.find((row) => row.capabilityId === capability.id); return <article className="rate-card" key={capability.id}><div className="rate-card-heading"><div><p className="page-kicker">PRICING SCENARIO</p><h3>{capability.name}</h3></div><span>per {capability.billableUnit.toLowerCase()}</span></div><div className="rate-columns"><RateInput label="UWA researcher" calculated={calculated?.sustainableRates.UWA} disabled={readOnly} value={item?.uwaRate || ""} share={item?.uwaSharePct || ""} onRate={(value) => update(index, { uwaRate: value || null })} onShare={(value) => update(index, { uwaSharePct: value })} /><RateInput label="APFR" calculated={calculated?.sustainableRates.APFR} disabled={readOnly} value={item?.apfrRate || ""} share={item?.apfrSharePct || ""} onRate={(value) => update(index, { apfrRate: value || null })} onShare={(value) => update(index, { apfrSharePct: value })} /><RateInput label="Commercial" calculated={calculated?.sustainableRates.COMMERCIAL} disabled={readOnly} value={item?.commercialRate || ""} share={item?.commercialSharePct || ""} onRate={(value) => update(index, { commercialRate: value || null })} onShare={(value) => update(index, { commercialSharePct: value })} /></div><label>Pricing justification<textarea disabled={readOnly} value={item?.justification || ""} onChange={(event) => update(index, { justification: event.target.value })} /></label></article>; })}</div>
    {!readOnly && <div className="calculate-bar"><div><strong>Ready to refresh the scenario?</strong><span>Each calculation creates a new immutable snapshot.</span></div><button className="button primary" disabled={working} onClick={onCalculate} type="button">{working ? <LoaderCircle className="spin" size={17} /> : <CircleDollarSign size={17} />} Calculate & save snapshot</button></div>}
  </>;
}

function RateInput({ label, calculated, value, share, disabled, onRate, onShare }: { label: string; calculated?: string; value: string; share: string; disabled: boolean; onRate: (value: string) => void; onShare: (value: string) => void }) {
  return <div className="rate-input"><div><strong>{label}</strong><small>Minimum {calculated ? money(calculated) : "—"}</small></div><label>Proposed rate<span className="input-with-prefix"><b>$</b><input disabled={disabled} inputMode="decimal" placeholder={calculated || "0.00"} value={value} onChange={(event) => onRate(event.target.value)} /></span></label><label>Expected user mix<span className="input-with-suffix"><input disabled={disabled} inputMode="decimal" value={share} onChange={(event) => onShare(event.target.value)} /><b>%</b></span></label></div>;
}

function FinancialSummary({ result }: { result: CalculationResult }) {
  return <div className="financial-summary"><div><span>Gross user revenue</span><strong>{money(result.grossRevenue)}</strong></div><div><span>University overhead</span><strong>{money(result.universityOverhead)}</strong></div><div><span>Net platform recovery</span><strong>{money(result.netPlatformRecovery)}</strong></div><div className={Number(result.operatingBalance) >= 0 ? "positive" : "negative"}><span>Operating balance</span><strong>{money(result.operatingBalance)}</strong></div>{result.warnings.length > 0 && <p><AlertTriangle size={16} /> {result.warnings.join(" ")}</p>}</div>;
}

function StepReview({ aggregate, result, role, working, onStatus }: { aggregate: CostingCaseAggregate; result: CalculationResult | null; role: "EDITOR" | "REVIEWER"; working: boolean; onStatus: (status: string) => void }) {
  const snapshot = aggregate.snapshots[0];
  return <>
    <SectionIntro kicker="STEP 5" title="Review the evidence package" copy="The report is generated from an immutable calculation snapshot, so reviewers see exactly the inputs and formula that produced each result." />
    {!result || !snapshot ? <div className="notice warning"><AlertTriangle size={18} /> Return to Step 4 and create a calculation snapshot before review.</div> : <>
      <FinancialSummary result={result} />
      <div className="review-grid"><article className="review-card"><FileCheck2 size={22} /><h3>Snapshot ready</h3><p>{snapshot.formulaVersion.replaceAll("_", " ")} · {new Date(snapshot.createdAt).toLocaleString("en-AU")}</p><strong>{result.capabilities.length} capabilities</strong></article><article className="review-card"><ShieldCheck size={22} /><h3>Audit evidence</h3><p>All status changes and calculations are recorded without storing request payloads in the audit log.</p><strong>{aggregate.auditEvents.length} recorded events</strong></article></div>
      <div className="export-row"><a className="button primary" href={`/api/v1/cases/${aggregate.costingCase.id}/report.pdf?snapshot=${snapshot.id}`}><Download size={17} /> Download PDF</a><a className="button secondary" href={`/api/v1/cases/${aggregate.costingCase.id}/export.csv`}><FileSpreadsheet size={17} /> Export CSV</a></div>
    </>}
    <section className="approval-panel"><div><p className="page-kicker">APPROVAL GATE</p><h3>{aggregate.costingCase.status === "DRAFT" ? "Submit the evidence package" : aggregate.costingCase.status === "READY_FOR_REVIEW" ? "Reviewer decision required" : aggregate.costingCase.status === "APPROVED" ? "MVP case approved" : "Case archived"}</h3><p>This demonstration records workflow status; it does not replace UWA delegated-authority approval.</p></div><div className="button-row">{role === "EDITOR" && aggregate.costingCase.status === "DRAFT" && <button className="button primary" disabled={!snapshot || working} onClick={() => onStatus("READY_FOR_REVIEW")} type="button"><Send size={17} /> Submit for review</button>}{role === "REVIEWER" && aggregate.costingCase.status === "READY_FOR_REVIEW" && <><button className="button ghost" disabled={working} onClick={() => onStatus("DRAFT")} type="button"><ChevronLeft size={17} /> Changes required</button><button className="button approve" disabled={working} onClick={() => onStatus("APPROVED")} type="button"><Check size={17} /> Approve case</button></>}</div></section>
    <section className="audit-section" id="audit"><div className="subsection-heading"><div><h3>Audit history</h3><p>Newest event first.</p></div></div><div className="audit-list">{aggregate.auditEvents.map((event) => <div key={event.id}><span className="audit-dot" /><div><strong>{event.action.replaceAll("_", " ")}</strong><p>{event.details}</p></div><time>{new Date(event.createdAt).toLocaleString("en-AU")}</time></div>)}</div></section>
  </>;
}
