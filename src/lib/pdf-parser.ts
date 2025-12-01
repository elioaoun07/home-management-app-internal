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

/**
 * Parse PDF buffer and extract text
 * This wrapper avoids the test file loading issue in pdf-parse
 */
export async function parsePDF(buffer: Buffer): Promise<PDFData> {
  return pdf(buffer);
}
