import { hasGlare } from './glare-detection';
import { isBlurry, type GrayscaleImage } from './blur-detection';

export type DocumentQualityIssue = 'glare' | 'blurry' | null;

/** Glare is checked first: an overexposed capture is also likely to read as "blurry", but glare's coaching copy is more specific. */
export function evaluateDocumentQuality(image: GrayscaleImage): DocumentQualityIssue {
  if (hasGlare(image)) return 'glare';
  if (isBlurry(image)) return 'blurry';
  return null;
}
