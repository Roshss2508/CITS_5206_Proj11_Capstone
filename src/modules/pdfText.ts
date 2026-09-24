export type TextWidthMeasurer = (text: string) => number;

export function normalisePdfText(value: string) {
  return value
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\u00a0/g, " ")
    .replace(/[^\x20-\x7e\n]/g, "?");
}

function splitLongWord(word: string, maxWidth: number, measure: TextWidthMeasurer) {
  const parts: string[] = [];
  let current = "";

  for (const character of word) {
    const candidate = current + character;
    if (current && measure(candidate) > maxWidth) {
      parts.push(current);
      current = character;
    } else {
      current = candidate;
    }
  }

  if (current) parts.push(current);
  return parts;
}

export function wrapPdfText(value: string, maxWidth: number, measure: TextWidthMeasurer) {
  if (maxWidth <= 0) throw new Error("PDF text width must be greater than zero.");

  const lines: string[] = [];
  const paragraphs = normalisePdfText(value).split("\n");

  for (const paragraph of paragraphs) {
    const words = paragraph.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push("");
      continue;
    }

    let current = "";
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (measure(candidate) <= maxWidth) {
        current = candidate;
        continue;
      }

      if (current) {
        lines.push(current);
        current = "";
      }

      if (measure(word) <= maxWidth) {
        current = word;
        continue;
      }

      const parts = splitLongWord(word, maxWidth, measure);
      lines.push(...parts.slice(0, -1));
      current = parts.at(-1) || "";
    }

    if (current) lines.push(current);
  }

  return lines;
}
