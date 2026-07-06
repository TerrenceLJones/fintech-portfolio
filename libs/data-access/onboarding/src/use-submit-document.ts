import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { SubmitDocumentResponse } from '@fintech-portfolio/contracts';
import { evaluateDocumentQuality, type GrayscaleImage } from '@fintech-portfolio/domain-onboarding';
import { authenticatedFetch } from '@fintech-portfolio/data-access-auth';
import { extractGrayscaleImage } from './extract-grayscale-image';
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
}

async function postDocument(
  input: SubmitDocumentInput,
  extractImage: (file: File) => Promise<GrayscaleImage>,
): Promise<SubmitDocumentClientOutcome> {
  const image = await extractImage(input.file);
  const issue = evaluateDocumentQuality(image);
  if (issue) {
    return { outcome: issue };
  }

  const response = await authenticatedFetch('/api/onboarding/documents', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      ownerId: input.ownerId,
      fileName: input.file.name,
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
 * a capture that fails quality is never submitted for document-type verification, per US-CW-005's
 * technical notes. Only a quality-passing capture reaches the server, where type classification
 * (wrong_type) and the 3-attempt cap (blocked) are decided.
 */
export function useSubmitDocument(options: UseSubmitDocumentOptions = {}) {
  const extractImage = options.extractImage ?? extractGrayscaleImage;
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SubmitDocumentInput) => postDocument(input, extractImage),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ONBOARDING_STATUS_QUERY_KEY }),
  });
}
