import { afterEach, describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { render, screen } from '@testing-library/react';
import type { AuditEvent } from '@clearline/contracts';
import { registerMswServer } from '@clearline/mock-backend/test-factories';
import { clearAccessToken, setAccessToken } from '@clearline/data-access-auth';
import { AuditLogPage } from './AuditLogPage';

const server = registerMswServer();
afterEach(() => clearAccessToken());

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/audit']}>
        <AuditLogPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const EVENTS: AuditEvent[] = [
  {
    id: 'e_view',
    timestamp: '2026-06-29T15:00:00.000Z',
    actor: { id: 'user_3', name: 'Sofia Whitman', role: 'controller' },
    category: 'audit_access',
    action: 'Viewed audit log',
  },
  {
    id: 'e_card',
    timestamp: '2026-06-29T13:40:12.000Z',
    actor: { id: 'user_3', name: 'Sofia Whitman', role: 'controller' },
    category: 'card_control',
    action: 'Froze card',
    target: { label: '•••• 5567' },
    diff: { from: 'Active', to: 'Frozen', tone: 'neutral' },
  },
];

function stubSession(userId = 'user_3') {
  server.use(
    http.get('*/api/auth/session', () =>
      HttpResponse.json({
        userId,
        email: 'controller@clearline.dev',
        displayName: 'Sofia Whitman',
        role: 'controller',
        approvalLimit: null,
        currency: 'USD',
        isAdmin: false,
        isOwner: false,
      }),
    ),
  );
}

describe('AuditLogPage', () => {
  it('renders the append-only assurance and the log rows', async () => {
    setAccessToken('access_valid');
    stubSession();
    server.use(http.get('*/api/audit-log', () => HttpResponse.json({ events: EVENTS })));

    renderPage();

    expect(
      await screen.findByText(/Append-only · cannot be edited or deleted/),
    ).toBeInTheDocument();
    expect(await screen.findByText('Froze card')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Frozen')).toBeInTheDocument();
  });

  it('highlights the current viewer’s own access event (AC-06)', async () => {
    setAccessToken('access_valid');
    stubSession('user_3');
    server.use(http.get('*/api/audit-log', () => HttpResponse.json({ events: EVENTS })));

    const { container } = renderPage();

    await screen.findByText('Froze card');
    const selfRow = container.querySelector('[data-self-access="true"]');
    expect(selfRow).not.toBeNull();
    expect(selfRow).toHaveTextContent('Viewed audit log');
    expect(selfRow).toHaveTextContent('access recorded');
  });

  it('degrades to access-denied on a 403 rather than a broken page', async () => {
    setAccessToken('access_valid');
    stubSession();
    server.use(
      http.get('*/api/audit-log', () =>
        HttpResponse.json({ error: 'forbidden_role' }, { status: 403 }),
      ),
    );

    renderPage();

    expect(await screen.findByText("You don't have access to this")).toBeInTheDocument();
  });

  it('renders a payment event’s amount → recipient detail (AC-01)', async () => {
    setAccessToken('access_valid');
    stubSession();
    const paymentEvent: AuditEvent = {
      id: 'e_pay',
      timestamp: '2026-06-29T09:12:48.000Z',
      actor: { id: 'user_1', name: 'Marcus Okafor', role: 'finance_manager' },
      category: 'payment',
      action: 'Submitted payment',
      target: { label: 'pi_8f2a' },
      detail: '$12,400.00 → Acme Corp',
      meta: { idempotencyKey: 'idem_8f2a', outcome: 'submitted' },
    };
    server.use(http.get('*/api/audit-log', () => HttpResponse.json({ events: [paymentEvent] })));

    renderPage();

    expect(await screen.findByText('Submitted payment')).toBeInTheDocument();
    expect(screen.getByText('$12,400.00 → Acme Corp')).toBeInTheDocument();
  });

  it('shows an empty state when there are no events yet', async () => {
    setAccessToken('access_valid');
    stubSession();
    server.use(http.get('*/api/audit-log', () => HttpResponse.json({ events: [] })));

    renderPage();

    expect(await screen.findByText('No audit events yet')).toBeInTheDocument();
  });
});
