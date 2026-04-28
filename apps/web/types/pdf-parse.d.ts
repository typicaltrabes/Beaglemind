/**
 * Ambient module typings for pdf-parse 1.1.1, which ships only basic typings
 * via its CommonJS entry. Adding @types/pdf-parse triggers a resolution
 * conflict, so we declare the slice we actually use.
 */
declare module 'pdf-parse/lib/pdf-parse.js' {
  interface PdfParseResult {
    text: string;
    numpages?: number;
    numrender?: number;
    info?: unknown;
    metadata?: unknown;
    version?: string;
  }
  function pdfParse(
    data: Buffer | Uint8Array,
    options?: Record<string, unknown>,
  ): Promise<PdfParseResult>;
  export default pdfParse;
}
