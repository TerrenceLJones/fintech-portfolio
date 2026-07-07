import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { registerMswServer } from '@clearline/mock-backend/test-factories';
import { useSubmitDocument } from './use-submit-document';
import { setAccessToken, clearAccessToken } from '@clearline/data-access-auth';
import { createQueryWrapper } from './test/create-query-wrapper';
import { ONBOARDING_STATUS_QUERY_KEY } from './onboarding-status-query-key';
import type { GrayscaleImage } from '@clearline/domain-onboarding';

const server = registerMswServer();
const wrapper = createQueryWrapper({ mutations: { retry: false } });

function flatImage(value: number): GrayscaleImage {
  return { width: 6, height: 6, pixels: new Array(36).fill(value) };
}

function checkerboardImage(): GrayscaleImage {
  const pixels: number[] = [];
  for (let y = 0; y < 6; y++) {
    for (let x = 0; x < 6; x++) pixels.push((x + y) % 2 === 0 ? 60 : 180);
  }
  return { width: 6, height: 6, pixels };
}

/** Canned OCR text — production runs Tesseract.js in the browser; tests inject deterministic text. */
const recognizeLicense = () => Promise.resolve('CALIFORNIA DRIVER LICENSE DL I1234562');

const file = new File(['fake-bytes'], 'capture.jpg', { type: 'image/jpeg' });

describe('useSubmitDocument', () => {
  afterEach(() => clearAccessToken());

  it('rejects a glare-affected capture client-side without calling the server or OCR', async () => {
    setAccessToken('access_valid');
    let serverCalled = false;
    const recognizeText = vi.fn(recognizeLicense);
    server.use(
      http.post('*/api/onboarding/documents', () => {
        serverCalled = true;
        return HttpResponse.json({ outcome: 'accepted', attemptCount: 0 });
      }),
    );

    const { result } = renderHook(
      () =>
        useSubmitDocument({ extractImage: () => Promise.resolve(flatImage(255)), recognizeText }),
      { wrapper },
    );
    result.current.mutate({ file, ownerId: 'owner_1' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ outcome: 'glare' });
    expect(serverCalled).toBe(false);
    // A capture that fails the quality gate is never OCR'd.
    expect(recognizeText).not.toHaveBeenCalled();
  });

  it('rejects a blurry capture client-side without calling the server', async () => {
    setAccessToken('access_valid');
    let serverCalled = false;
    server.use(
      http.post('*/api/onboarding/documents', () => {
        serverCalled = true;
        return HttpResponse.json({ outcome: 'accepted', attemptCount: 0 });
      }),
    );

    const { result } = renderHook(
      () =>
        useSubmitDocument({
          extractImage: () => Promise.resolve(flatImage(128)),
          recognizeText: recognizeLicense,
        }),
      { wrapper },
    );
    result.current.mutate({ file, ownerId: 'owner_1' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ outcome: 'blurry' });
    expect(serverCalled).toBe(false);
  });

  it('OCRs a sharp capture and submits the recognized text to the server', async () => {
    setAccessToken('access_valid');
    let submittedBody: unknown;
    server.use(
      http.post('*/api/onboarding/documents', async ({ request }) => {
        submittedBody = await request.json();
        return HttpResponse.json({ outcome: 'accepted', attemptCount: 0 });
      }),
    );

    const { result } = renderHook(
      () =>
        useSubmitDocument({
          extractImage: () => Promise.resolve(checkerboardImage()),
          recognizeText: recognizeLicense,
        }),
      { wrapper },
    );
    result.current.mutate({ file, ownerId: 'owner_1' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ outcome: 'accepted', attemptCount: 0 });
    expect(submittedBody).toEqual({
      ownerId: 'owner_1',
      ocrText: 'CALIFORNIA DRIVER LICENSE DL I1234562',
      mimeType: 'image/jpeg',
    });
  });

  it('surfaces the server-reported wrong_type outcome for a quality-passing but unrecognized document', async () => {
    setAccessToken('access_valid');
    server.use(
      http.post('*/api/onboarding/documents', () =>
        HttpResponse.json({ outcome: 'wrong_type', attemptCount: 1 }),
      ),
    );

    const { result } = renderHook(
      () =>
        useSubmitDocument({
          extractImage: () => Promise.resolve(checkerboardImage()),
          recognizeText: () => Promise.resolve('WHOLE FOODS MARKET RECEIPT'),
        }),
      { wrapper },
    );
    result.current.mutate({ file, ownerId: 'owner_1' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ outcome: 'wrong_type', attemptCount: 1 });
  });

  it('invalidates the cached onboarding status once a submission reaches the server', async () => {
    setAccessToken('access_valid');
    server.use(
      http.post('*/api/onboarding/documents', () =>
        HttpResponse.json({ outcome: 'accepted', attemptCount: 0 }),
      ),
    );
    const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    queryClient.setQueryData(ONBOARDING_STATUS_QUERY_KEY, { documentAttemptCount: 0 });

    const { result } = renderHook(
      () =>
        useSubmitDocument({
          extractImage: () => Promise.resolve(checkerboardImage()),
          recognizeText: recognizeLicense,
        }),
      {
        wrapper: ({ children }) => (
          <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
        ),
      },
    );
    result.current.mutate({ file, ownerId: 'owner_1' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(queryClient.getQueryState(ONBOARDING_STATUS_QUERY_KEY)?.isInvalidated).toBe(true);
  });

  it('does not invalidate the cached onboarding status when a capture is rejected client-side', async () => {
    setAccessToken('access_valid');
    let serverCalled = false;
    server.use(
      http.post('*/api/onboarding/documents', () => {
        serverCalled = true;
        return HttpResponse.json({ outcome: 'accepted', attemptCount: 0 });
      }),
    );
    const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    queryClient.setQueryData(ONBOARDING_STATUS_QUERY_KEY, { documentAttemptCount: 0 });

    const { result } = renderHook(
      () =>
        useSubmitDocument({
          extractImage: () => Promise.resolve(flatImage(255)),
          recognizeText: recognizeLicense,
        }),
      {
        wrapper: ({ children }) => (
          <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
        ),
      },
    );
    result.current.mutate({ file, ownerId: 'owner_1' });

    // A glare/blur rejection never reaches the server and changes no server-side state, so it
    // must not trigger a needless onboarding-status refetch.
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ outcome: 'glare' });
    expect(serverCalled).toBe(false);
    expect(queryClient.getQueryState(ONBOARDING_STATUS_QUERY_KEY)?.isInvalidated).toBe(false);
  });
});
