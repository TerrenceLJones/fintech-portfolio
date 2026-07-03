import type { ReactElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/** `queryClient` defaults to a fresh client — pass one explicitly to override defaultOptions, e.g. `retry: false`. */
export function withQueryClient(ui: ReactElement, queryClient: QueryClient = new QueryClient()) {
  return <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>;
}
