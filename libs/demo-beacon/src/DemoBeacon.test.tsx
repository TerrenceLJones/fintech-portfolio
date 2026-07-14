import { afterEach, describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DemoBeaconProvider } from './registry/DemoBeaconProvider';
import { useDemoBeacon } from './registry/useDemoBeacon';
import type { DemoBeaconPageConfig } from './types';

/** Test page that registers a config for as long as it's mounted. */
function Page({ config }: { config: DemoBeaconPageConfig }) {
  useDemoBeacon(config);
  return <div>page: {config.pageId}</div>;
}

function cfg(
  pageId: string,
  title: string,
  extra?: Partial<DemoBeaconPageConfig>,
): DemoBeaconPageConfig {
  return { pageId, title, sections: [], ...extra };
}

async function openPanel(user: ReturnType<typeof userEvent.setup>) {
  const launcher = await screen.findByRole('button', { name: /demo guide/i });
  await user.click(launcher);
  return screen.findByRole('dialog');
}

afterEach(cleanup);

describe('DemoBeacon registration', () => {
  it('shows the fallback when no page has registered', async () => {
    const user = userEvent.setup();
    render(
      <DemoBeaconProvider appName="Clearline" fallback={cfg('fallback', 'Fallback guide')}>
        <div>no page</div>
      </DemoBeaconProvider>,
    );
    const dialog = await openPanel(user);
    expect(dialog).toHaveTextContent('Fallback guide');
  });

  it('lets a registered page override the fallback', async () => {
    const user = userEvent.setup();
    render(
      <DemoBeaconProvider appName="Clearline" fallback={cfg('fallback', 'Fallback guide')}>
        <Page config={cfg('login', 'Sign in')} />
      </DemoBeaconProvider>,
    );
    const dialog = await openPanel(user);
    expect(dialog).toHaveTextContent('Sign in');
    expect(dialog).not.toHaveTextContent('Fallback guide');
  });

  it('last-registered wins, and the previous config resurfaces on unmount', async () => {
    function Harness() {
      const [leafMounted, setLeafMounted] = useState(true);
      return (
        <DemoBeaconProvider appName="Clearline">
          <Page config={cfg('layout', 'Layout guide')} />
          {leafMounted ? <Page config={cfg('leaf', 'Leaf guide')} /> : null}
          <button onClick={() => setLeafMounted(false)}>unmount leaf</button>
        </DemoBeaconProvider>
      );
    }
    const user = userEvent.setup();
    render(<Harness />);

    const dialog = await openPanel(user);
    expect(dialog).toHaveTextContent('Leaf guide'); // last registered wins

    await user.click(screen.getByRole('button', { name: 'unmount leaf' }));
    await waitFor(() => expect(screen.getByRole('dialog')).toHaveTextContent('Layout guide'));
  });
});

describe('DemoBeacon sections', () => {
  it('copies the raw value, not the masked display', async () => {
    // userEvent.setup() installs its own clipboard stub — copy through it and read it back rather
    // than spying on navigator.clipboard (which it would overwrite).
    const user = userEvent.setup();
    render(
      <DemoBeaconProvider appName="Clearline">
        <Page
          config={cfg('cards', 'Cards', {
            sections: [
              {
                kind: 'copyable',
                title: 'Test card',
                items: [{ label: 'Card', value: '4242424242424242', display: '•••• 4242' }],
              },
            ],
          })}
        />
      </DemoBeaconProvider>,
    );
    const dialog = await openPanel(user);
    expect(dialog).toHaveTextContent('•••• 4242');
    await user.click(screen.getByRole('button', { name: 'Copy' }));
    await waitFor(async () =>
      expect(await navigator.clipboard.readText()).toBe('4242424242424242'),
    );
  });

  it('renders entity getter rows, and an error state when the getter rejects', async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <DemoBeaconProvider appName="Clearline">
        <Page
          config={cfg('ok', 'OK', {
            sections: [
              {
                kind: 'entities',
                title: 'Rows',
                columns: [{ key: 'name', label: 'Name' }],
                rows: () => Promise.resolve([{ name: 'Acme' }]),
              },
            ],
          })}
        />
      </DemoBeaconProvider>,
    );
    await openPanel(user);
    expect(await screen.findByText('Acme')).toBeInTheDocument();

    rerender(
      <DemoBeaconProvider appName="Clearline">
        <Page
          config={cfg('bad', 'Bad', {
            sections: [
              {
                kind: 'entities',
                title: 'Rows',
                columns: [{ key: 'name', label: 'Name' }],
                rows: () => Promise.reject(new Error('boom')),
              },
            ],
          })}
        />
      </DemoBeaconProvider>,
    );
    expect(await screen.findByText(/couldn’t load/i)).toBeInTheDocument();
  });

  it('runs entity rowActions — copies a value, and navigates + closes on a link action', async () => {
    const onNavigate = vi.fn();
    const user = userEvent.setup();
    render(
      <DemoBeaconProvider appName="Clearline" onNavigate={onNavigate}>
        <Page
          config={cfg('recips', 'Recipients', {
            sections: [
              {
                kind: 'entities',
                title: 'Seed',
                columns: [{ key: 'name', label: 'Name' }],
                rows: [{ name: 'Acme' }],
                rowActions: () => [
                  { label: 'Copy #', copy: '000104188' },
                  { label: 'Open', navigateTo: '/payments/x' },
                ],
              },
            ],
          })}
        />
      </DemoBeaconProvider>,
    );
    await openPanel(user);

    await user.click(screen.getByRole('button', { name: 'Copy #' }));
    await waitFor(async () => expect(await navigator.clipboard.readText()).toBe('000104188'));

    await user.click(screen.getByRole('button', { name: 'Open' }));
    expect(onNavigate).toHaveBeenCalledWith('/payments/x');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('gates a destructive action behind a confirm step', async () => {
    const run = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(
      <DemoBeaconProvider appName="Clearline">
        <Page
          config={cfg('reset', 'Reset', {
            sections: [
              {
                kind: 'actions',
                title: 'Danger',
                actions: [
                  {
                    id: 'r',
                    label: 'Reset demo data',
                    run,
                    confirm: 'Sure?',
                    variant: 'destructive',
                  },
                ],
              },
            ],
          })}
        />
      </DemoBeaconProvider>,
    );
    await openPanel(user);

    await user.click(screen.getByRole('button', { name: 'Reset demo data' }));
    expect(run).not.toHaveBeenCalled(); // confirm gate
    expect(screen.getByText('Sure?')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(run).toHaveBeenCalledOnce();
  });

  it('reflects a toggle’s initial state and flips it through set()', async () => {
    let armed = false;
    const set = vi.fn((on: boolean) => {
      armed = on;
    });
    const user = userEvent.setup();
    render(
      <DemoBeaconProvider appName="Clearline">
        <Page
          config={cfg('login', 'Login', {
            sections: [
              {
                kind: 'toggles',
                title: 'Scenarios',
                toggles: [{ id: 'outage', label: 'Simulate auth outage', get: () => armed, set }],
              },
            ],
          })}
        />
      </DemoBeaconProvider>,
    );
    await openPanel(user);

    const sw = await screen.findByRole('switch', { name: 'Simulate auth outage' });
    await waitFor(() => expect(sw).toHaveAttribute('aria-checked', 'false'));

    await user.click(sw);
    expect(set).toHaveBeenCalledWith(true);
    expect(sw).toHaveAttribute('aria-checked', 'true');

    await user.click(sw);
    expect(set).toHaveBeenLastCalledWith(false);
    expect(sw).toHaveAttribute('aria-checked', 'false');
  });

  it('reverts the switch when set() rejects', async () => {
    const set = vi.fn().mockRejectedValue(new Error('nope'));
    const user = userEvent.setup();
    render(
      <DemoBeaconProvider appName="Clearline">
        <Page
          config={cfg('login', 'Login', {
            sections: [
              {
                kind: 'toggles',
                title: 'Scenarios',
                toggles: [{ id: 'outage', label: 'Auth outage', get: () => false, set }],
              },
            ],
          })}
        />
      </DemoBeaconProvider>,
    );
    await openPanel(user);

    const sw = await screen.findByRole('switch', { name: 'Auth outage' });
    await user.click(sw);
    await waitFor(() => expect(sw).toHaveAttribute('aria-checked', 'false'));
    expect(screen.getByText('nope')).toBeInTheDocument();
  });

  it('invokes onNavigate for a flow step and closes the panel', async () => {
    const onNavigate = vi.fn();
    const user = userEvent.setup();
    render(
      <DemoBeaconProvider appName="Clearline" onNavigate={onNavigate}>
        <Page
          config={cfg('flow', 'Flow', {
            sections: [
              {
                kind: 'flows',
                title: 'Flows',
                flows: [
                  { id: 'f', title: 'Do it', steps: [{ text: 'Go there', navigateTo: '/there' }] },
                ],
              },
            ],
          })}
        />
      </DemoBeaconProvider>,
    );
    await openPanel(user);
    await user.click(screen.getByRole('button', { name: 'Go →' }));

    expect(onNavigate).toHaveBeenCalledWith('/there');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('closes on Escape', async () => {
    const user = userEvent.setup();
    render(
      <DemoBeaconProvider appName="Clearline">
        <Page config={cfg('p', 'Page')} />
      </DemoBeaconProvider>,
    );
    await openPanel(user);
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});

describe('useDemoBeacon without a provider', () => {
  it('is a no-op (no throw) when no provider is mounted', () => {
    expect(() => render(<Page config={cfg('x', 'X')} />)).not.toThrow();
  });
});
