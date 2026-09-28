import type { Metadata } from "next";
import { CaseAudit } from "@/components/CaseAudit";
import { getCase } from "@/src/modules/repository";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  try {
    const aggregate = await getCase((await params).id);
    const title = `Audit history — ${aggregate.costingCase.platformName} | RIC Costing Case`;
    return { title, robots: { index: false, follow: false } };
  } catch {
    return { title: "Audit history | RIC Costing Case", robots: { index: false, follow: false } };
  }
}

export default async function CaseAuditPage({ params }: { params: Promise<{ id: string }> }) {
  return <CaseAudit caseId={(await params).id} />;
}
