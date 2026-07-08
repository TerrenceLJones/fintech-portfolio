import { describe, expect, it } from 'vitest';
import { hasGlare, computeOverexposedRatio, type GrayscaleImage } from './glare-detection';

function flatImage(width: number, height: number, value: number): GrayscaleImage {
  return { width, height, pixels: new Array(width * height).fill(value) };
}

function halfOverexposedImage(width: number, height: number): GrayscaleImage {
  const pixels: number[] = new Array(width * height).fill(80);
  for (let i = 0; i < pixels.length / 2; i++) pixels[i] = 255;
  return { width, height, pixels };
}

describe('computeOverexposedRatio', () => {
  it('is 0 for a well-exposed mid-gray image', () => {
    expect(computeOverexposedRatio(flatImage(4, 4, 128))).toBe(0);
  });

  it('is 1 for a fully blown-out white image', () => {
    expect(computeOverexposedRatio(flatImage(4, 4, 255))).toBe(1);
  });

  it('is 0.5 when half the pixels are overexposed', () => {
    expect(computeOverexposedRatio(halfOverexposedImage(4, 4))).toBe(0.5);
  });
});

describe('hasGlare', () => {
  it('does not flag a well-exposed image', () => {
    expect(hasGlare(flatImage(4, 4, 128))).toBe(false);
  });

  it('flags a fully blown-out image', () => {
    expect(hasGlare(flatImage(4, 4, 255))).toBe(true);
  });

  it('flags an image with a majority-overexposed region', () => {
    expect(hasGlare(halfOverexposedImage(4, 4))).toBe(true);
  });
});
