/**
 * Deterministic OCR double for the dev/e2e environment, installed only when the MSW mock backend is
 * running (see main.tsx). It stands in for the browser Tesseract.js recognizer so e2e stays fast and
 * offline — instead of reading pixels, it derives "recognized text" from the fixture's file name.
 * Fixtures are named for the document they represent (e.g. `drivers-license-sharp.png`), so the
 * server's OCR-text classifier resolves them exactly as it would resolve real recognized text.
 *
 * This is a test double for the OCR *device*, not a reintroduction of filename-based classification:
 * the real recognizer OCRs actual pixels in production, and the server still classifies from text.
 */
export function mockDocumentOcr(file: File): Promise<string> {
  return Promise.resolve(file.name.replace(/[-_.]/g, ' '));
}
