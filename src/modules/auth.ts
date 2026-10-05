import type { Actor, ActorRole } from "@/src/modules/types";

const DEMO_ACTORS: Record<ActorRole, Actor> = {
  EDITOR: { id: "demo-editor", name: "Alex Morgan", role: "EDITOR" },
  REVIEWER: { id: "demo-reviewer", name: "Erika Slavin", role: "REVIEWER" },
};

export function getDemoActor(request: Request): Actor {
  const requestedRole = request.headers.get("x-demo-role")?.toUpperCase();
  return requestedRole === "REVIEWER" ? DEMO_ACTORS.REVIEWER : DEMO_ACTORS.EDITOR;
}

export function requireRole(actor: Actor, ...allowed: ActorRole[]) {
  if (!allowed.includes(actor.role)) throw new Response("This demo role is not allowed to perform that action.", { status: 403 });
}

/** Maps a persisted actor id (e.g. a snapshot's `createdBy`) back to its demo display name. */
export function getActorName(actorId: string): string {
  return Object.values(DEMO_ACTORS).find((actor) => actor.id === actorId)?.name ?? actorId;
}
