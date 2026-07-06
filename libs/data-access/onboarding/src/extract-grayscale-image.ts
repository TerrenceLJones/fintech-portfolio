import type { GrayscaleImage } from '@fintech-portfolio/domain-onboarding';

/** Downscales the capture before analysis — keeps the pixel-analysis cost bounded regardless of the original photo's resolution. */
const ANALYSIS_MAX_DIMENSION = 64;

/**
 * Real canvas-based pixel extraction — no unit test here, same as access-token-store's
 * sessionStorage calls are exercised indirectly rather than directly: `createImageBitmap` and a
 * 2D canvas context aren't available in the happy-dom test environment, so there's nothing a
 * unit test could meaningfully assert beyond "did it throw." useSubmitDocument's tests inject a
 * fake `extractImage` instead, exercising every real branch (glare/blurry/sharp) without needing
 * this browser-API glue to run at all.
 */
export async function extractGrayscaleImage(file: File): Promise<GrayscaleImage> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, ANALYSIS_MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('canvas_2d_context_unavailable');
  }
  context.drawImage(bitmap, 0, 0, width, height);
  const { data } = context.getImageData(0, 0, width, height);

  const pixels: number[] = [];
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i] ?? 0;
    const g = data[i + 1] ?? 0;
    const b = data[i + 2] ?? 0;
    pixels.push(Math.round(0.299 * r + 0.587 * g + 0.114 * b));
  }
  return { width, height, pixels };
}
