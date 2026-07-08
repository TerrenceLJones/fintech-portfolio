import { describe, expect, it } from 'vitest';
import { isBlurry, computeLaplacianVariance, type GrayscaleImage } from './blur-detection';

function flatImage(width: number, height: number, value: number): GrayscaleImage {
  return { width, height, pixels: new Array(width * height).fill(value) };
}

function checkerboardImage(width: number, height: number): GrayscaleImage {
  const pixels: number[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      pixels.push((x + y) % 2 === 0 ? 0 : 255);
    }
  }
  return { width, height, pixels };
}

describe('computeLaplacianVariance', () => {
  it('is zero for a perfectly flat image', () => {
    expect(computeLaplacianVariance(flatImage(6, 6, 128))).toBe(0);
  });

  it('is high for a high-contrast checkerboard image', () => {
    expect(computeLaplacianVariance(checkerboardImage(6, 6))).toBeGreaterThan(1000);
  });
});

describe('isBlurry', () => {
  it('flags a flat, low-detail image as blurry', () => {
    expect(isBlurry(flatImage(6, 6, 128))).toBe(true);
  });

  it('does not flag a sharp, high-contrast image as blurry', () => {
    expect(isBlurry(checkerboardImage(6, 6))).toBe(false);
  });
});
