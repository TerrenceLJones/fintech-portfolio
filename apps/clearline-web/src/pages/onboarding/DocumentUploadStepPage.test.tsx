import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { registerMswServer } from '@clearline/mock-backend/test-factories';
import { setAccessToken, clearAccessToken } from '@clearline/data-access-auth';
import * as dataAccessOnboarding from '@clearline/data-access-onboarding';
import { DocumentUploadStepPage } from './DocumentUploadStepPage';

const server = registerMswServer();

interface MockSubmitDocumentResult {
  outcome: 'accepted' | 'wrong_type' | 'blocked' | 'glare' | 'blurry';
  attemptCount: number;
  supportReferenceId?: string;
}

interface MockMutationOptions {
  onSuccess: (result: MockSubmitDocumentResult, input: unknown) => void;
}

function statusResponse(overrides: Record<string, unknown> = {}) {
  return {
    businessId: 'business_1',
    status: 'in_progress',
    currentStep: 'documents',
    lastCompletedStep: 'owners',
    business: null,
    owners: [
      {
        id: 'owner_1',
        firstName: 'Dara',
        lastName: 'Reyes',
        fullName: 'Dara Reyes',
        ownershipPercent: 60,
        requiresKyc: true,
      },
      {
        id: 'owner_2',
        firstName: 'Marcus',
        lastName: 'Okafor',
        fullName: 'Marcus Okafor',
        ownershipPercent: 10,
        requiresKyc: false,
      },
    ],
    documents: [],
    documentAttemptCount: 0,
    lastActivityAt: 0,
    sessionTimedOut: false,
    ...overrides,
  };
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/onboarding/documents']}>
        <Routes>
          <Route path="/onboarding/documents" element={<DocumentUploadStepPage />} />
          <Route path="/onboarding/review" element={<div>Review step stub</div>} />
          <Route path="/onboarding/status" element={<div>Status page stub</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('DocumentUploadStepPage', () => {
  afterEach(() => {
    clearAccessToken();
    vi.restoreAllMocks();
  });

  it('renders one dropzone per owner requiring KYC, and none for others', async () => {
    setAccessToken('access_valid');
    server.use(http.get('*/api/onboarding/status', () => HttpResponse.json(statusResponse())));
    renderPage();

    await waitFor(() => expect(screen.getByText(/Dara Reyes/)).toBeInTheDocument());
    expect(screen.queryByText(/Marcus Okafor/)).not.toBeInTheDocument();
  });

  it('marks a document accepted and enables Continue once every KYC owner has one', async () => {
    setAccessToken('access_valid');
    server.use(http.get('*/api/onboarding/status', () => HttpResponse.json(statusResponse())));
    vi.spyOn(dataAccessOnboarding, 'useSubmitDocument').mockReturnValue({
      mutate: (input: unknown, opts: MockMutationOptions) =>
        opts.onSuccess({ outcome: 'accepted', attemptCount: 0 }, input),
      isPending: false,
    } as never);

    const user = userEvent.setup();
    renderPage();

    await waitFor(() => expect(screen.getByText(/Dara Reyes/)).toBeInTheDocument());
    const input = screen.getByLabelText(/browse/i, { selector: 'input' });
    const file = new File(['x'], 'drivers-license.jpg', { type: 'image/jpeg' });
    await user.upload(input, file);

    await waitFor(() => expect(screen.getByText('Quality check passed')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /continue/i })).not.toHaveAttribute(
      'aria-disabled',
      'true',
    );
  });

  it('navigates to /onboarding/status when a document submission comes back blocked', async () => {
    setAccessToken('access_valid');
    server.use(http.get('*/api/onboarding/status', () => HttpResponse.json(statusResponse())));
    vi.spyOn(dataAccessOnboarding, 'useSubmitDocument').mockReturnValue({
      mutate: (input: unknown, opts: MockMutationOptions) =>
        opts.onSuccess(
          { outcome: 'blocked', attemptCount: 3, supportReferenceId: 'SR-ABCD1234' },
          input,
        ),
      isPending: false,
    } as never);

    const user = userEvent.setup();
    renderPage();

    await waitFor(() => expect(screen.getByText(/Dara Reyes/)).toBeInTheDocument());
    const input = screen.getByLabelText(/browse/i, { selector: 'input' });
    const file = new File(['x'], 'unrecognized.jpg', { type: 'image/jpeg' });
    await user.upload(input, file);

    await waitFor(() => expect(screen.getByText('Status page stub')).toBeInTheDocument());
  });

  it('enables Continue immediately when no owner requires KYC', async () => {
    setAccessToken('access_valid');
    server.use(
      http.get('*/api/onboarding/status', () =>
        HttpResponse.json(
          statusResponse({
            owners: [
              {
                id: 'owner_2',
                firstName: 'Marcus',
                lastName: 'Okafor',
                fullName: 'Marcus Okafor',
                ownershipPercent: 10,
                requiresKyc: false,
              },
            ],
          }),
        ),
      ),
    );
    renderPage();

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /continue/i })).not.toHaveAttribute(
        'aria-disabled',
        'true',
      ),
    );
  });

  it('keeps Continue disabled before the onboarding status has loaded', async () => {
    setAccessToken('access_valid');
    server.use(
      http.get(
        '*/api/onboarding/status',
        () => new Promise(() => {}), // never resolves — asserts the pre-load state, not a real hang
      ),
    );
    renderPage();

    expect(screen.getByRole('button', { name: /continue/i })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
  });

  it('shows a generic error message when a document submission fails on the network/server', async () => {
    setAccessToken('access_valid');
    server.use(http.get('*/api/onboarding/status', () => HttpResponse.json(statusResponse())));
    vi.spyOn(dataAccessOnboarding, 'useSubmitDocument').mockReturnValue({
      mutate: () => {},
      isPending: false,
      isError: true,
    } as never);

    renderPage();

    await waitFor(() =>
      expect(screen.getByText('Something went wrong. Please try again.')).toBeInTheDocument(),
    );
  });
});
