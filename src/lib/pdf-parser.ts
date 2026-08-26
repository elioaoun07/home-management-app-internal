// src/lib/pdf-parser.ts
// Custom PDF parser wrapper to avoid pdf-parse test file issue

import pdf from "pdf-parse/lib/pdf-parse.js";

export interface PDFData {
  numpages: number;
  numrender: number;
  info: Record<string, unknown>;
  metadata: Record<string, unknown> | null;
  text: string;
  version: string;
}

interface PDFTextItem {
  str: string;
  transform: number[];
}

interface PDFPageData {
  getTextContent(options: {
    normalizeWhitespace: boolean;
    disableCombineTextItems: boolean;
  }): Promise<{ items: PDFTextItem[] }>;
}

/**
 * `pdf-parse`'s bundled renderer concatenates every text item sharing a Y
 * coordinate. On the bank's PDFs the MONEY IN and BALANCE cells are separate
 * PDF items but touch visually, so a credit such as `2,534.00 2,534.00` became
 * `2,534.002,534.00` and the statement parser discarded it as unreadable.
 *
 * Keep the PDF's own reading order, group adjacent items on the same visual
 * line, sort those items left-to-right, and restore a separator between them.
 * Descriptions may wrap onto another Y coordinate; parsePDFText already joins
 * those physical lines into one transaction block.
 */
async function renderStatementPage(page: PDFPageData): Promise<string> {
  const content = await page.getTextContent({
    normalizeWhitespace: true,
    disableCombineTextItems: false,
  });

  const lines: string[] = [];
  let currentY: number | null = null;
  let currentLine: Array<{ x: number; text: string }> = [];

  const flush = () => {
    if (currentLine.length === 0) return;
    currentLine.sort((a, b) => a.x - b.x);
    const line = currentLine
      .map((item) => item.text)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    if (line) lines.push(line);
    currentLine = [];
  };

  for (const item of content.items) {
    const x = item.transform[4] ?? 0;
    const y = item.transform[5] ?? 0;
    if (currentY !== null && Math.abs(y - currentY) > 0.5) flush();
    currentLine.push({ x, text: item.str });
    currentY = y;
  }
  flush();

  return lines.join("\n");
}

/**
 * Parse PDF buffer and extract text
 * This wrapper avoids the test file loading issue in pdf-parse
 */
export async function parsePDF(buffer: Buffer): Promise<PDFData> {
  const parse = pdf as unknown as (
    data: Buffer,
    options: { pagerender: typeof renderStatementPage },
  ) => Promise<PDFData>;
  return parse(buffer, { pagerender: renderStatementPage });
}
