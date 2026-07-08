export interface GrayscaleImage {
  width: number;
  height: number;
  /** Row-major grayscale intensities, 0 (black) to 255 (white). */
  pixels: number[];
}

/** Below this Laplacian variance, an image is considered too low-detail to be a readable document capture. */
export const BLUR_VARIANCE_THRESHOLD = 50;

function pixelAt(image: GrayscaleImage, x: number, y: number): number {
  return image.pixels[y * image.width + x] ?? 0;
}

/** Variance of the discrete Laplacian across interior pixels — a standard proxy for image sharpness. */
export function computeLaplacianVariance(image: GrayscaleImage): number {
  const laplacians: number[] = [];
  for (let y = 1; y < image.height - 1; y++) {
    for (let x = 1; x < image.width - 1; x++) {
      const laplacian =
        4 * pixelAt(image, x, y) -
        pixelAt(image, x - 1, y) -
        pixelAt(image, x + 1, y) -
        pixelAt(image, x, y - 1) -
        pixelAt(image, x, y + 1);
      laplacians.push(laplacian);
    }
  }
  if (laplacians.length === 0) return 0;

  const mean = laplacians.reduce((sum, value) => sum + value, 0) / laplacians.length;
  return laplacians.reduce((sum, value) => sum + (value - mean) ** 2, 0) / laplacians.length;
}

export function isBlurry(image: GrayscaleImage, threshold = BLUR_VARIANCE_THRESHOLD): boolean {
  return computeLaplacianVariance(image) < threshold;
}
