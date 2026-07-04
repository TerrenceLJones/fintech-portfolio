import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider, type DefaultOptions } from '@tanstack/react-query';

/**
 * Replaces the identical `wrapper({ children })` function redefined in every hook test file here
 * — only the `mutations`/`queries` `retry: false` key differs between them. Returns a fresh
 * `QueryClient` on every render, same as the original inline versions.
 */
export function createQueryWrapper(defaultOptions: DefaultOptions) {
  return function wrapper({ children }: { children: ReactNode }) {
    const queryClient = new QueryClient({ defaultOptions });
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}
