import { afterEach, describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { renderHook, waitFor } from '@testing-library/react';
import { registerMswServer } from '@clearline/mock-backend/test-factories';
import { clearAccessToken, setAccessToken } from '@clearline/data-access-auth';
import { SettingsForbiddenError } from './settings-forbidden-error';
import { useSettingsSectionAccess } from './use-settings-section-access';
import { createQueryWrapper } from './test/create-query-wrapper';

const server = registerMswServer();
const wrapper = createQueryWrapper({ queries: { retry: false } });

afterEach(() => clearAccessToken());

describe('useSettingsSectionAccess', () => {
  it('resolves when the server authorizes the section', async () => {
    setAccessToken('access_valid');
    server.use(
      http.get('*/api/settings/sections/:slug', ({ params }) =>
        HttpResponse.json({ slug: params.slug, authorized: true }),
      ),
    );

    const { result } = renderHook(() => useSettingsSectionAccess('billing'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.authorized).toBe(true);
  });

  it('maps a 403 to a typed SettingsForbiddenError (access-denied)', async () => {
    setAccessToken('access_valid');
    server.use(
      http.get('*/api/settings/sections/:slug', () =>
        HttpResponse.json({ error: 'forbidden_role' }, { status: 403 }),
      ),
    );

    const { result } = renderHook(() => useSettingsSectionAccess('billing'), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(SettingsForbiddenError);
  });

  it('throws a generic error (not SettingsForbiddenError) on a non-403 failure', async () => {
    setAccessToken('access_valid');
    server.use(
      http.get('*/api/settings/sections/:slug', () => new HttpResponse(null, { status: 500 })),
    );

    const { result } = renderHook(() => useSettingsSectionAccess('billing'), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error).not.toBeInstanceOf(SettingsForbiddenError);
  });
});
