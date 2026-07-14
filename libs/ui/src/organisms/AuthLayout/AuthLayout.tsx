import type { ReactNode } from 'react';
import { Icon } from '../../foundations/Icon';
import { Container } from '../../atoms/Container';
import { Text } from '../../atoms/Text';

const DEFAULT_HEADLINE = 'The finance-ops control plane for modern teams.';
const DEFAULT_SUBCOPY =
  'Corporate cards, approvals, AP automation and reconciliation — every balance derived from an immutable ledger.';
const DEFAULT_FOOTER = 'SOC 2 Type II · 256-bit encryption';

export interface AuthLayoutProps {
  headline?: string;
  subcopy?: string;
  /** Pass `null` to omit the footer line entirely (an omitted prop still gets the default). */
  footer?: string | null;
  children: ReactNode;
}

/**
 * Branded split-screen shell for auth pages (login, password reset, etc.): a gradient hero panel
 * with the Clearline brand message on wide viewports, and a centered form slot. Below the `lg`
 * breakpoint the hero panel hides and a small inline wordmark takes its place above the form slot,
 * so the brand is never entirely absent.
 */
export function AuthLayout({
  headline = DEFAULT_HEADLINE,
  subcopy = DEFAULT_SUBCOPY,
  footer = DEFAULT_FOOTER,
  children,
}: AuthLayoutProps) {
  return (
    // Pin auth to the light theme. The app's ThemeProvider writes `data-theme` to <html> from the
    // user's persisted preference, so a logged-out user who last used dark mode would otherwise
    // inherit dark surface tokens here — rendering the form inputs near-black. Re-declaring
    // `data-theme="light"` on this shell re-scopes every `--cl-*` token to its light value for the
    // whole auth subtree, independent of what <html> carries.
    <div data-theme="light" className="flex min-h-screen">
      <div
        className="hidden overflow-hidden p-10 lg:flex lg:w-1/2 lg:flex-col lg:justify-between lg:text-white"
        style={{
          backgroundImage:
            'linear-gradient(155deg, var(--cl-accent-2), var(--cl-accent) 60%, #1d3a9e)',
        }}
      >
        <div className="flex items-center gap-2.5">
          <Icon name="logo" size={22} />
          <Text as="span" size="heading">
            Clearline
          </Text>
        </div>
        <div>
          <Text as="div" size="title" className="mb-2.5 leading-tight tracking-tight">
            {headline}
          </Text>
          <Text as="div" size="label" weight="regular" className="opacity-80">
            {subcopy}
          </Text>
        </div>
        {footer ? (
          <Text as="div" size="mono" className="opacity-70">
            {footer}
          </Text>
        ) : null}
      </div>

      <div className="flex flex-1 items-center justify-center p-6">
        <Container width="sm" center={false} padded={false}>
          <div className="mb-6 flex items-center gap-2 lg:hidden">
            <Icon name="logo" size={20} className="text-cl-accent" />
            <Text as="span" size="heading" tone="default">
              Clearline
            </Text>
          </div>
          {children}
        </Container>
      </div>
    </div>
  );
}
