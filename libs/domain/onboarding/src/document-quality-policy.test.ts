import { describe, expect, it } from 'vitest';
import { evaluateDocumentQuality } from './document-quality-policy';
import type { GrayscaleImage } from './blur-detection';

function flatImage(width: number, height: number, value: number): GrayscaleImage {
  return { width, height, pixels: new Array(width * height).fill(value) };
}

function checkerboardImage(width: number, height: number): GrayscaleImage {
  const pixels: number[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      pixels.push((x + y) % 2 === 0 ? 60 : 180);
    }
  }
  return { width, height, pixels };
}

describe('evaluateDocumentQuality', () => {
  it('reports glare for a blown-out image', () => {
    expect(evaluateDocumentQuality(flatImage(6, 6, 255))).toBe('glare');
  });

  it('reports blurry for a flat, well-exposed image', () => {
    expect(evaluateDocumentQuality(flatImage(6, 6, 128))).toBe('blurry');
  });

  it('reports no issue for a sharp, well-exposed image', () => {
    expect(evaluateDocumentQuality(checkerboardImage(6, 6))).toBe(null);
  });

  it('prioritizes glare over blur when both conditions are met', () => {
    expect(evaluateDocumentQuality(flatImage(6, 6, 255))).toBe('glare');
  });
});
