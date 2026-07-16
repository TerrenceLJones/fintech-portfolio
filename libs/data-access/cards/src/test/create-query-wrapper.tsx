import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider, type DefaultOptions } from '@tanstack/react-query';

/** Fresh-QueryClient-per-render helper, mirroring libs/data-access/payments's copy. */
export function createQueryWrapper(defaultOptions: DefaultOptions) {
  return function wrapper({ children }: { children: ReactNode }) {
    const queryClient = new QueryClient({ defaultOptions });
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}
