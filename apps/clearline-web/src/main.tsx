import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from './App';

async function bootstrap() {
  if (import.meta.env.DEV) {
    // Dynamic import so the MSW browser-worker code never ships in a production build.
    const { worker } = await import('@fintech-portfolio/mock-backend/browser');
    await worker.start({ onUnhandledRequest: 'bypass' });
  }

  const queryClient = new QueryClient();
  const rootElement = document.getElementById('root');
  if (!rootElement) throw new Error('Missing #root element');

  createRoot(rootElement).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </QueryClientProvider>
    </StrictMode>,
  );
}

bootstrap().catch((error) => {
  // Without this, a rejection anywhere in bootstrap (e.g. MSW worker registration failing)
  // leaves the page blank with no on-screen indication that anything went wrong.
  console.error('Failed to start app:', error);
});
