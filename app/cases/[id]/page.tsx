import type { Metadata } from "next";
import { CaseWizard } from "@/components/CaseWizard";
import { getCase } from "@/src/modules/repository";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  try {
    const aggregate = await getCase((await params).id);
    const title = `${aggregate.costingCase.platformName} | RIC Costing Case`;
    const description = `${aggregate.costingCase.pricingPeriod} pricing case — ${aggregate.costingCase.status.replaceAll("_", " ").toLowerCase()}.`;
    return {
      title,
      description,
      robots: { index: false, follow: false },
      openGraph: { title, description, images: [] },
      twitter: { card: "summary", title, description, images: [] },
    };
  } catch {
    return { title: "RIC Costing Case", description: "Research infrastructure costing and pricing case.", robots: { index: false, follow: false }, openGraph: { images: [] }, twitter: { images: [] } };
  }
}

export default async function CasePage({ params }: { params: Promise<{ id: string }> }) {
  return <CaseWizard caseId={(await params).id} />;
}
