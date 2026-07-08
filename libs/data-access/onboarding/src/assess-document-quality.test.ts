import { describe, expect, it } from 'vitest';
import type { GrayscaleImage } from '@clearline/domain-onboarding';
import { assessDocumentQuality } from './assess-document-quality';

function flatImage(value: number): GrayscaleImage {
  return { width: 6, height: 6, pixels: new Array(36).fill(value) };
}

function checkerboardImage(): GrayscaleImage {
  const pixels: number[] = [];
  for (let y = 0; y < 6; y++) {
    for (let x = 0; x < 6; x++) pixels.push((x + y) % 2 === 0 ? 60 : 180);
  }
  return { width: 6, height: 6, pixels };
}

const file = new File(['fake-bytes'], 'capture.jpg', { type: 'image/jpeg' });

describe('assessDocumentQuality', () => {
  it('flags an overexposed capture as glare', async () => {
    const issue = await assessDocumentQuality(file, () => Promise.resolve(flatImage(255)));
    expect(issue).toBe('glare');
  });

  it('flags a low-contrast capture as blurry', async () => {
    const issue = await assessDocumentQuality(file, () => Promise.resolve(flatImage(128)));
    expect(issue).toBe('blurry');
  });

  it('returns null for a sharp, well-exposed capture', async () => {
    const issue = await assessDocumentQuality(file, () => Promise.resolve(checkerboardImage()));
    expect(issue).toBeNull();
  });
});
