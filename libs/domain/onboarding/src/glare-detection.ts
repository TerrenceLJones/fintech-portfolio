export type { GrayscaleImage } from './blur-detection';
import type { GrayscaleImage } from './blur-detection';

/** Pixel intensities at or above this are considered overexposed/blown-out. */
export const GLARE_BRIGHTNESS_THRESHOLD = 250;

/** Above this fraction of overexposed pixels, the capture is considered glare-affected. */
export const GLARE_PIXEL_RATIO_THRESHOLD = 0.3;

export function computeOverexposedRatio(image: GrayscaleImage): number {
  if (image.pixels.length === 0) return 0;
  const overexposedCount = image.pixels.filter(
    (value) => value >= GLARE_BRIGHTNESS_THRESHOLD,
  ).length;
  return overexposedCount / image.pixels.length;
}

export function hasGlare(
  image: GrayscaleImage,
  ratioThreshold = GLARE_PIXEL_RATIO_THRESHOLD,
): boolean {
  return computeOverexposedRatio(image) > ratioThreshold;
}
