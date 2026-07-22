import { afterEach, describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { renderHook, waitFor } from '@testing-library/react';
import type { OrgSecurityResponse } from '@clearline/contracts';
import { registerMswServer } from '@clearline/mock-backend/test-factories';
import { clearAccessToken, setAccessToken } from '@clearline/data-access-auth';
import { createQueryWrapper } from './test/create-query-wrapper';
import {
  OrgSecurityActionError,
  OrgSecurityForbiddenError,
  useAddIpRange,
  useOrgSecurity,
} from './use-org-security';

const server = registerMswServer();
afterEach(() => clearAccessToken());

const POSTURE: OrgSecurityResponse = {
  sso: {
    metadataUrl: null,
    entityId: null,
    certificateFingerprint: null,
    lastTest: null,
    enabled: false,
  },
  requireTwoFactor: false,
  idleTimeoutMinutes: 15,
  ipAllowlist: [],
  currentIp: '203.0.113.42',
};

describe('useOrgSecurity (AC-01/09)', () => {
  it('loads the org security posture', async () => {
    setAccessToken('access_valid');
    server.use(http.get('*/api/org-security', () => HttpResponse.json(POSTURE)));
    const { wrapper } = createQueryWrapper({ queries: { retry: false } });
    const { result } = renderHook(() => useOrgSecurity(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.currentIp).toBe('203.0.113.42');
  });

  it('surfaces a 403 as OrgSecurityForbiddenError (AC-09)', async () => {
    setAccessToken('access_valid');
    server.use(
      http.get('*/api/org-security', () =>
        HttpResponse.json({ error: 'forbidden_role' }, { status: 403 }),
      ),
    );
    const { wrapper } = createQueryWrapper({ queries: { retry: false } });
    const { result } = renderHook(() => useOrgSecurity(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(OrgSecurityForbiddenError);
  });
});

describe('useAddIpRange (AC-07)', () => {
  it('surfaces a self-lockout error with the named IP detail', async () => {
    setAccessToken('access_valid');
    server.use(
      http.post('*/api/org-security/ip-allowlist', () =>
        HttpResponse.json({ error: 'self_lockout', detail: '203.0.113.42' }, { status: 422 }),
      ),
    );
    const { wrapper } = createQueryWrapper({
      queries: { retry: false },
      mutations: { retry: false },
    });
    const { result } = renderHook(() => useAddIpRange(), { wrapper });
    result.current.mutate('198.51.100.0/24');
    await waitFor(() => expect(result.current.isError).toBe(true));
    const error = result.current.error as OrgSecurityActionError;
    expect(error).toBeInstanceOf(OrgSecurityActionError);
    expect(error.code).toBe('self_lockout');
    expect(error.detail).toBe('203.0.113.42');
  });
});
