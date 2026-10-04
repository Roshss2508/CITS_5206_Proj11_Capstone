import { describe, expect, it } from "vitest";
import { getActorName } from "@/src/modules/auth";

describe("getActorName", () => {
  it("maps a known demo actor id to its display name", () => {
    expect(getActorName("demo-editor")).toBe("Alex Morgan");
    expect(getActorName("demo-reviewer")).toBe("Erika Slavin");
  });

  it("falls back to the raw id when it does not match a known demo actor", () => {
    expect(getActorName("some-other-actor")).toBe("some-other-actor");
  });
});
