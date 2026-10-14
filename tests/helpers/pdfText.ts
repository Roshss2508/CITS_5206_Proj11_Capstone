import { inflateSync } from "node:zlib";

/** Read the direct-length streams emitted by pdf-lib; this is not a general PDF parser. */
export function extractPdfText(bytes: Buffer): string {
  const raw = bytes.toString("latin1");
  let decoded = "";
  const streamRe = /<<([\s\S]*?)>>\s*stream\r?\n/g;
  let streamMatch: RegExpExecArray | null;
  while ((streamMatch = streamRe.exec(raw))) {
    const length = /\/Length\s+(\d+)\s*(?:\r?\n|$)/.exec(streamMatch[1]);
    if (!length) throw new Error("Expected a direct PDF stream length from pdf-lib.");
    const end = streamRe.lastIndex + Number(length[1]);
    const stream = bytes.subarray(streamRe.lastIndex, end);
    if (stream.length !== Number(length[1])) throw new Error("Truncated PDF stream.");
    // A binary stream can itself end in CR/LF. Never trim those bytes as a delimiter.
    decoded += /\/FlateDecode\b/.test(streamMatch[1]) ? inflateSync(stream).toString("latin1") : stream.toString("latin1");
    streamRe.lastIndex = end;
  }
  const strings: string[] = [];
  const hexRe = /<([0-9A-Fa-f]+)>\s*Tj/g;
  let hexMatch: RegExpExecArray | null;
  while ((hexMatch = hexRe.exec(decoded))) strings.push(Buffer.from(hexMatch[1], "hex").toString("latin1"));
  const literalRe = /\(((?:[^()\\]|\\.)*)\)\s*Tj/g;
  let literalMatch: RegExpExecArray | null;
  while ((literalMatch = literalRe.exec(decoded))) strings.push(literalMatch[1].replace(/\\(.)/g, "$1"));
  return strings.join(" ");
}
