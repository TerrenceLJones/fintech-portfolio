import { describe, expect, it } from 'vitest';
import { mockDocumentOcr } from './mock-document-ocr';

// The dev double is the linchpin of the onboarding e2e: it turns a fixture's file name into the
// "recognized text" the server classifies by. Asserting the exact strings here localizes a future
// break (a fixture rename, a regex tweak) to a fast unit failure instead of a confusing e2e one.
describe('mockDocumentOcr', () => {
  it('derives driver-license text the classifier recognizes from the sharp fixture', async () => {
    const file = new File(['x'], 'drivers-license-sharp.png', { type: 'image/png' });
    await expect(mockDocumentOcr(file)).resolves.toBe('drivers license sharp png');
  });

  it('derives text without any ID keyword from the unrecognized fixture', async () => {
    const file = new File(['x'], 'unrecognized-document.png', { type: 'image/png' });
    await expect(mockDocumentOcr(file)).resolves.toBe('unrecognized document png');
  });
});
