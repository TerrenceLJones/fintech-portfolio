import { afterEach, describe, expect, it } from 'vitest';
import { recognizeDocumentText, setDocumentTextRecognizer } from './recognize-document-text';

// These only exercise the override seam — the real Tesseract.js branch loads a WASM core + language
// model that can't run in the test environment (see recognizeDocumentText's doc comment), so it's
// left to inject a double, exactly as the dev bootstrap does. afterEach clears the global so it
// can never leak the real recognizer past these tests.
describe('recognizeDocumentText override seam', () => {
  afterEach(() => setDocumentTextRecognizer(null));

  it('delegates to an installed recognizer instead of running real OCR', async () => {
    const file = new File(['bytes'], 'id.png', { type: 'image/png' });
    setDocumentTextRecognizer((f) => Promise.resolve(`stub:${f.name}`));

    await expect(recognizeDocumentText(file)).resolves.toBe('stub:id.png');
  });

  it('passes the original file through to the installed recognizer', async () => {
    const file = new File(['bytes'], 'passport.png', { type: 'image/png' });
    let received: File | null = null;
    setDocumentTextRecognizer((f) => {
      received = f;
      return Promise.resolve('ok');
    });

    await recognizeDocumentText(file);

    expect(received).toBe(file);
  });
});
