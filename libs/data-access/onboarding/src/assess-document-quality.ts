import {
  evaluateDocumentQuality,
  type DocumentQualityIssue,
  type GrayscaleImage,
} from '@clearline/domain-onboarding';
import { extractGrayscaleImage } from './extract-grayscale-image';

/**
 * Reusable client-side capture-quality gate: decodes the file to grayscale pixels and runs the
 * pure glare/blur checks. Document-type-agnostic, so any upload flow (ID capture today, other
 * business documents later) can reuse it. `extractImage` is injectable for tests, since the real
 * canvas-based extractor needs browser APIs unavailable in the test environment.
 */
export async function assessDocumentQuality(
  file: File,
  extractImage: (file: File) => Promise<GrayscaleImage> = extractGrayscaleImage,
): Promise<DocumentQualityIssue> {
  const image = await extractImage(file);
  return evaluateDocumentQuality(image);
}
