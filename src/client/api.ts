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

export interface ApiFieldIssue { path: string; message: string }

export class ApiError extends Error {
  issues: ApiFieldIssue[];
  constructor(message: string, issues: ApiFieldIssue[] = []) {
    super(message);
    this.name = "ApiError";
    this.issues = issues;
  }
}

export async function apiRequest<T>(url: string, role: ActorRole, init: RequestInit = {}): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", "x-demo-role": role, ...(init.headers || {}) },
  });
  const contentType = response.headers.get("content-type") || "";
  const payload = (contentType.includes("application/json") ? await response.json() : { error: await response.text() }) as
    { error?: string; issues?: Array<{ path: Array<string | number>; message: string }> } & T;
  if (!response.ok) {
    const issues = (payload.issues || []).map((issue) => ({ path: issue.path.join("."), message: issue.message }));
    throw new ApiError(payload.error || `Request failed (${response.status}).`, issues);
  }
  return payload as T;
}
