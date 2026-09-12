import type { Metadata } from "next";
import { Suspense } from "react";
import { BusinessRules } from "@/components/BusinessRules";

export const metadata: Metadata = {
  title: "Business Rules | RIC Costing",
  description: "Confirmed RIC Formula V1 business rules for research infrastructure costing and pricing, and the items still awaiting client confirmation.",
  robots: { index: false, follow: false },
};

export default function BusinessRulesPage() {
  return (
    <Suspense fallback={null}>
      <BusinessRules />
    </Suspense>
  );
}
