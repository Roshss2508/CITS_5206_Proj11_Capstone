import { describe, expect, it } from "vitest";
import { ApiError } from "@/src/client/api";
import { describeApiIssues, describeError } from "@/src/client/errorMessages";

describe("describeApiIssues", () => {
  it("names the row and field for an array item issue", () => {
    const message = describeApiIssues([{ path: "costs.1.amount", message: "Enter a non-negative amount with up to two decimal places." }]);
    expect(message).toBe("Row 2 – Amount: Enter a non-negative amount with up to two decimal places.");
  });

  it("falls back to a friendly label for a top-level field issue", () => {
    const message = describeApiIssues([{ path: "platformName", message: "Too short." }]);
    expect(message).toBe("Platform name: Too short.");
  });

  it("joins multiple issues into one readable message", () => {
    const message = describeApiIssues([
      { path: "capacity.0.forecastUtilisationPct", message: "Forecast billable units must be greater than zero." },
      { path: "capacity.1.maximumCapacity", message: "Enter a non-negative number with up to six decimal places." },
    ]);
    expect(message).toBe(
      "Row 1 – Forecast utilisation: Forecast billable units must be greater than zero. "
      + "Row 2 – Maximum capacity: Enter a non-negative number with up to six decimal places.",
    );
  });

  it("falls back to the raw path segment when it has no friendly label mapping", () => {
    const message = describeApiIssues([{ path: "proposedRates.0", message: "UWA, APFR and Commercial user shares must total exactly 100%." }]);
    expect(message).toBe("Row 1 – proposedRates: UWA, APFR and Commercial user shares must total exactly 100%.");
  });
});

describe("describeError", () => {
  it("prefers field-level issue detail over the generic API error message", () => {
    const error = new ApiError("Please correct the highlighted information.", [{ path: "capabilities.0.name", message: "Enter at least 2 characters." }]);
    expect(describeError(error, "fallback")).toBe("Row 1 – Capability name: Enter at least 2 characters.");
  });

  it("uses the error message when there are no field issues", () => {
    const error = new ApiError("Costing case not found.");
    expect(describeError(error, "fallback")).toBe("Costing case not found.");
  });

  it("uses the fallback for a non-Error value", () => {
    expect(describeError("boom", "fallback")).toBe("fallback");
  });
});
