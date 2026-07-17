import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider, type DefaultOptions } from '@tanstack/react-query';

/** Same fresh-QueryClient-per-render helper as the other data-access packages — retry defaults differ per test. */
export function createQueryWrapper(defaultOptions: DefaultOptions) {
  return function wrapper({ children }: { children: ReactNode }) {
    const queryClient = new QueryClient({ defaultOptions });
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}
