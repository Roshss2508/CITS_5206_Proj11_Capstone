"use client";
/* eslint-disable @next/next/no-html-link-for-pages */

import { usePathname } from "next/navigation";
import { BookOpenText, Calculator, ClipboardCheck, LayoutDashboard } from "lucide-react";

export function ProductSidebar({ active = "cases" }: { active?: "cases" | "rules" | "audit" }) {
  const pathname = usePathname();
  // From an open case, carry the case path along so Business Rules can send the user back to it
  // rather than defaulting to the dashboard.
  const rulesHref = pathname?.startsWith("/cases/") ? `/business-rules?from=${encodeURIComponent(pathname)}` : "/business-rules";
  return (
    <aside className="product-sidebar">
      <a className="product-brand" href="/">
        <span className="brand-mark">RI</span>
        <span><small>UWA RESEARCH INFRASTRUCTURE</small><strong>Costing & Pricing</strong></span>
      </a>
      <nav aria-label="Primary navigation">
        <a className={active === "cases" ? "active" : ""} href="/"><LayoutDashboard size={18} /> Costing cases</a>
        <a className={active === "rules" ? "active" : ""} href={rulesHref}><Calculator size={18} /> Business rules</a>
        <a className={active === "audit" ? "active" : ""} href="#audit"><ClipboardCheck size={18} /> Audit history</a>
      </nav>
      <div className="sidebar-guidance">
        <BookOpenText size={18} />
        <div><strong>Demo workspace</strong><span>Synthetic data only</span></div>
      </div>
    </aside>
  );
}
