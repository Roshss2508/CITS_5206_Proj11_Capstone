import { deflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { extractPdfText } from "./helpers/pdfText";

describe("PDF export test text extraction", () => {
  it("preserves a compressed stream's final CR byte rather than consuming it as CRLF", () => {
    let content = "<534E415053484F545F54574F5F4D41524B4552> Tj\n%";
    let compressed = deflateSync(content);
    // Adler-32's final byte reaches CR deterministically by appending TAB bytes.
    for (let i = 0; compressed.at(-1) !== 13 && i < 256; i++) {
      content += "\t";
      compressed = deflateSync(content);
    }
    expect(compressed.at(-1)).toBe(13);
    const pdf = Buffer.concat([
      Buffer.from(`%PDF-1.7\n1 0 obj\n<<\n/Filter /FlateDecode\n/Length ${compressed.length}\n>>\nstream\n`),
      compressed, Buffer.from("\nendstream\nendobj\n"),
    ]);
    expect(extractPdfText(pdf)).toBe("SNAPSHOT_TWO_MARKER");
  });

  it("handles uncompressed literal strings and multiple streams", () => {
    const stream = "(First) Tj";
    const pdf = Buffer.from(`<<\n/Length ${stream.length}\n>>\nstream\n${stream}\nendstream\n`.repeat(2));
    expect(extractPdfText(pdf)).toBe("First First");
  });
});
