import type { ReactNode } from 'react';
import { ThemeProvider, useTheme } from '@fintech-portfolio/design-tokens';
import { Icon } from '@fintech-portfolio/icons';

export interface AppShellProps {
  title?: string;
  maxWidth?: number;
  children?: ReactNode;
}

function TopBar({ title }: { title?: string }) {
  const { theme, setTheme } = useTheme();

  return (
    <div className="bg-cl-surface/86 border-cl-border sticky top-0 z-30 flex items-center justify-between border-b px-8 py-3.5 backdrop-blur-md">
      <div className="flex items-center gap-2.75">
        <Icon name="logo" size={22} className="text-cl-accent" />
        <span className="text-[16px] font-semibold tracking-tight">Clearline</span>
        {title ? (
          <span className="text-cl-text-3 border-cl-border-2 ml-1 rounded-md border px-1.75 py-0.5 text-[11px] font-medium">
            {title}
          </span>
        ) : null}
      </div>
      <div className="bg-cl-surface-2 border-cl-border flex items-center gap-1.5 rounded-lg border p-0.75">
        {(['light', 'dark'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTheme(t)}
            className={[
              'rounded-md px-3.5 py-1.5 text-xs font-medium',
              theme === t ? 'bg-cl-surface text-cl-text shadow-sm' : 'text-cl-text-3',
            ].join(' ')}
          >
            {t === 'light' ? 'Light' : 'Dark'}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Owns tokens + theme + the sticky top bar — a screen just wraps its content in `<AppShell>`, no per-page boilerplate. */
export function AppShell({ title, maxWidth = 1200, children }: AppShellProps) {
  return (
    <ThemeProvider>
      <div className="bg-cl-bg text-cl-text min-h-screen font-sans text-sm leading-relaxed">
        <TopBar title={title} />
        <div className="mx-auto px-8 pt-9 pb-24" style={{ maxWidth }}>
          {children}
        </div>
      </div>
    </ThemeProvider>
  );
}
