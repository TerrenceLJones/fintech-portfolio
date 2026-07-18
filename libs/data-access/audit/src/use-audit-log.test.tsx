import { afterEach, describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { renderHook, waitFor } from '@testing-library/react';
import type { AuditLogResponse } from '@clearline/contracts';
import { registerMswServer } from '@clearline/mock-backend/test-factories';
import { clearAccessToken, setAccessToken } from '@clearline/data-access-auth';
import { AuditForbiddenError } from './audit-forbidden-error';
import { useAuditLog } from './use-audit-log';
import { createQueryWrapper } from './test/create-query-wrapper';

const server = registerMswServer();
const wrapper = createQueryWrapper({ queries: { retry: false } });

afterEach(() => clearAccessToken());

const SAMPLE: AuditLogResponse = {
  events: [
    {
      id: 'e1',
      timestamp: '2026-06-29T14:22:07.000Z',
      actor: { id: 'user_3', name: 'Sofia Whitman', role: 'controller' },
      category: 'audit_access',
      action: 'Viewed audit log',
    },
  ],
};

describe('useAuditLog', () => {
  it('resolves with the append-only log', async () => {
    setAccessToken('access_valid');
    server.use(http.get('*/api/audit-log', () => HttpResponse.json(SAMPLE)));

    const { result } = renderHook(() => useAuditLog(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.events).toHaveLength(1);
    expect(result.current.data?.events[0]?.action).toBe('Viewed audit log');
  });

  it('surfaces a 403 as AuditForbiddenError so the page can render access-denied', async () => {
    setAccessToken('access_valid');
    server.use(
      http.get('*/api/audit-log', () =>
        HttpResponse.json({ error: 'forbidden_role' }, { status: 403 }),
      ),
    );

    const { result } = renderHook(() => useAuditLog(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(AuditForbiddenError);
  });
});
