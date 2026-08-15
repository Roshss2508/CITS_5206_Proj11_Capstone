"use client";

import { ShieldCheck, UserRound } from "lucide-react";
import type { ActorRole } from "@/src/modules/types";

export function DemoRoleToggle({ role, onChange }: { role: ActorRole; onChange: (role: ActorRole) => void }) {
  return (
    <div className="role-toggle" aria-label="Demo role">
      <button className={role === "EDITOR" ? "selected" : ""} onClick={() => onChange("EDITOR")} type="button">
        <UserRound size={15} /> Editor
      </button>
      <button className={role === "REVIEWER" ? "selected" : ""} onClick={() => onChange("REVIEWER")} type="button">
        <ShieldCheck size={15} /> Reviewer
      </button>
    </div>
  );
}
