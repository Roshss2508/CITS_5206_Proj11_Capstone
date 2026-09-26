"use client";

import { useState } from "react";
import type { ActorRole } from "@/src/modules/types";

/**
 * Stores and retrieves the selected demo role.
 * The role persists across page navigation and refreshes using localStorage.
 */

export function useDemoRole() {
  // Load the saved role, or default to Editor if none is valid.
  const [role, setRoleState] = useState<ActorRole>(() => {
    const storedRole = window.localStorage.getItem("ric-demo-role");

    return storedRole === "EDITOR" || storedRole === "REVIEWER"
      ? storedRole
      : "EDITOR";
  });

  // Update both localStorage and the current React state.
  const setRole = (next: ActorRole) => {
    window.localStorage.setItem("ric-demo-role", next);
    setRoleState(next);
  };

  return [role, setRole] as const;
}

/**
 * Represents a validation error for a specific API field.
 */
export interface ApiFieldIssue { path: string; message: string }

/**
 * Custom API error that can include field-level validation issues.
 */
export class ApiError extends Error {
  issues: ApiFieldIssue[];
  constructor(message: string, issues: ApiFieldIssue[] = []) {
    super(message);
    this.name = "ApiError";
    this.issues = issues;
  }
}

/**
 * Sends an API request using the selected demo role.
 * Converts unsuccessful responses into ApiError instances.
 */
export async function apiRequest<T>(url: string, role: ActorRole, init: RequestInit = {}): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", "x-demo-role": role, ...(init.headers || {}) },
  });
  
  // Handle both JSON and plain-text responses.
  const contentType = response.headers.get("content-type") || "";
  const payload = (contentType.includes("application/json") ? await response.json() : { error: await response.text() }) as
    { error?: string; issues?: Array<{ path: Array<string | number>; message: string }> } & T;

  // Convert failed responses into a consistent application error.
  if (!response.ok) {
    const issues = (payload.issues || []).map((issue) => ({ path: issue.path.join("."), message: issue.message }));
    throw new ApiError(payload.error || `Request failed (${response.status}).`, issues);
  }
  return payload as T;
}
