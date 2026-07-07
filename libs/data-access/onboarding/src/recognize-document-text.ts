export type DocumentTextRecognizer = (file: File) => Promise<string>;

/**
 * Dev/e2e seam. When the MSW mock backend is running there is no real ID-verification vendor, and
 * downloading Tesseract's WASM core + language model into the browser (and running it) would make
 * e2e slow and network-dependent. So the dev bootstrap installs a deterministic OCR double here;
 * production never sets one, so the real recognizer below runs. This mirrors how the hook lets
 * tests inject `recognizeText` — same seam, at the app-composition level.
 */
let overrideRecognizer: DocumentTextRecognizer | null = null;
export function setDocumentTextRecognizer(recognizer: DocumentTextRecognizer | null): void {
  overrideRecognizer = recognizer;
}

/**
 * Real browser OCR — no unit test here, same rationale as extract-grayscale-image's canvas glue:
 * Tesseract.js loads a WASM core and language model that aren't available (or worth downloading) in
 * the test environment, so there's nothing a unit test could meaningfully assert. useSubmitDocument
 * accepts an injectable `recognizeText`, and its tests supply a fake returning canned text instead,
 * exercising every classification branch without running the recognizer.
 *
 * tesseract.js is dynamically imported so its ~MBs of WASM + worker code stay out of the initial
 * bundle and only load when a user actually submits a document.
 */
export async function recognizeDocumentText(file: File): Promise<string> {
  if (overrideRecognizer) {
    return overrideRecognizer(file);
  }

  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker('eng');
  try {
    const { data } = await worker.recognize(file);
    return data.text;
  } finally {
    await worker.terminate();
  }
}
