import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider, type DefaultOptions } from '@tanstack/react-query';

/** Fresh-QueryClient-per-render helper mirroring the other data-access packages. */
export function createQueryWrapper(defaultOptions: DefaultOptions) {
  const queryClient = new QueryClient({ defaultOptions });
  function wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  return { wrapper, queryClient };
}
