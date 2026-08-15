"use client";

import { useState } from "react";
import type { ActorRole } from "@/src/modules/types";

export function useDemoRole() {
  const [role, setRoleState] = useState<ActorRole>("EDITOR");
  const setRole = (next: ActorRole) => {
    window.localStorage.setItem("ric-demo-role", next);
    setRoleState(next);
  };
  return [role, setRole] as const;
}

export async function apiRequest<T>(url: string, role: ActorRole, init: RequestInit = {}): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", "x-demo-role": role, ...(init.headers || {}) },
  });
  const contentType = response.headers.get("content-type") || "";
  const payload = (contentType.includes("application/json") ? await response.json() : { error: await response.text() }) as { error?: string } & T;
  if (!response.ok) throw new Error(payload.error || `Request failed (${response.status}).`);
  return payload as T;
}
