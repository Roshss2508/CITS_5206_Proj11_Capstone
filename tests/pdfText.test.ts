import { describe, expect, it } from "vitest";
import { normalisePdfText, wrapPdfText } from "@/src/modules/pdfText";

describe("normalisePdfText", () => {
  it("converts common English punctuation supported by the standard PDF font", () => {
    expect(normalisePdfText("2027\u20132029 \u201cquoted\u201d \u2014 it\u2019s ready"))
      .toBe('2027-2029 "quoted" - it\'s ready');
  });
});

describe("wrapPdfText", () => {
  const characterWidth = (text: string) => text.length;

  it("wraps long evidence text within the available width", () => {
    const text = "Scheduled preventive maintenance and specialist technical support for the research facility.";
    const lines = wrapPdfText(text, 24, characterWidth);

    expect(lines.length).toBeGreaterThan(1);
    expect(lines.every((line) => line.length <= 24)).toBe(true);
    expect(lines.join(" ")).toBe(text);
  });

  it("splits a single word that is wider than the page", () => {
    const text = "averylongunbrokenreferencevalue";
    const lines = wrapPdfText(text, 8, characterWidth);

    expect(lines.every((line) => line.length <= 8)).toBe(true);
    expect(lines.join("")).toBe(text);
  });
});
