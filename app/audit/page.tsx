import type { Metadata } from "next";
import { AuditLanding } from "@/components/AuditLanding";

export const metadata: Metadata = {
  title: "Audit history | RIC Costing",
  description: "Audit history is tracked per costing case. Choose a case to view its audit trail.",
  robots: { index: false, follow: false },
};

export default function AuditPage() {
  return <AuditLanding />;
}
