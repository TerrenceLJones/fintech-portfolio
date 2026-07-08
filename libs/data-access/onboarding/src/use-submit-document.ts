import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { SubmitDocumentResponse } from '@clearline/contracts';
import type { GrayscaleImage } from '@clearline/domain-onboarding';
import { authenticatedFetch } from '@clearline/data-access-auth';
import { extractGrayscaleImage } from './extract-grayscale-image';
import { assessDocumentQuality } from './assess-document-quality';
import { recognizeDocumentText } from './recognize-document-text';
import { ONBOARDING_STATUS_QUERY_KEY } from './onboarding-status-query-key';

export interface SubmitDocumentInput {
  file: File;
  ownerId: string;
}

/** A client-side quality rejection never reaches the server, so it never counts toward the 3-attempt cap (US-CW-005 AC-01/AC-02). */
export type SubmitDocumentClientOutcome = { outcome: 'glare' | 'blurry' } | SubmitDocumentResponse;

export interface UseSubmitDocumentOptions {
  /** Overridable for tests — production uses real canvas-based pixel extraction. */
  extractImage?: (file: File) => Promise<GrayscaleImage>;
  /** Overridable for tests — production uses real browser OCR (Tesseract.js). */
  recognizeText?: (file: File) => Promise<string>;
}

async function postDocument(
  input: SubmitDocumentInput,
  extractImage: (file: File) => Promise<GrayscaleImage>,
  recognizeText: (file: File) => Promise<string>,
): Promise<SubmitDocumentClientOutcome> {
  const issue = await assessDocumentQuality(input.file, extractImage);
  if (issue) {
    return { outcome: issue };
  }

  // Only a quality-passing capture is OCR'd — the recognized text (not the raw image) is what the
  // server classifies by, so document-type detection stays server-side while the image bytes never
  // leave the browser.
  const ocrText = await recognizeText(input.file);

  const response = await authenticatedFetch('/api/onboarding/documents', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      ownerId: input.ownerId,
      ocrText,
      mimeType: input.file.type,
    }),
  });
  if (!response.ok) {
    throw new Error('submit_document_failed');
  }
  return response.json();
}

/**
 * Runs the client-side quality gate (glare/blur pixel analysis) before ever calling the backend —
 * a capture that fails quality is never OCR'd or submitted for document-type verification, per
 * US-CW-005's technical notes. Only a quality-passing capture is OCR'd and reaches the server,
 * where type classification (wrong_type) and the 3-attempt cap (blocked) are decided.
 */
export function useSubmitDocument(options: UseSubmitDocumentOptions = {}) {
  const extractImage = options.extractImage ?? extractGrayscaleImage;
  const recognizeText = options.recognizeText ?? recognizeDocumentText;
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SubmitDocumentInput) => postDocument(input, extractImage, recognizeText),
    onSuccess: (result) => {
      // A client-side glare/blur rejection never reached the server, so no server-side state
      // changed — skip the invalidation to avoid a needless onboarding-status refetch.
      if (result.outcome === 'glare' || result.outcome === 'blurry') return;
      queryClient.invalidateQueries({ queryKey: ONBOARDING_STATUS_QUERY_KEY });
    },
  });
}
