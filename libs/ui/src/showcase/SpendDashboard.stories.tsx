import type { Meta, StoryObj } from '@storybook/react-vite';
import { AppShell } from '../decorators/AppShell';
import { WindowFrame } from '../decorators/WindowFrame';
import { NavItem } from '../molecules/NavItem';
import { Avatar } from '../atoms/Avatar';
import { Button } from '../atoms/Button';
import { MoneyDisplay } from '../foundations/MoneyDisplay';
import { ProgressBar } from '../atoms/ProgressBar';
import { AIInsightCard } from '../molecules/AIInsightCard';
import { EmptyState } from '../organisms/EmptyState';
import { Alert } from '../atoms/Alert';

const meta: Meta = {
  title: 'Showcase/Spend Dashboard (end-to-end)',
};
export default meta;

type Story = StoryObj;

const CATEGORIES = [
  { label: 'Payroll & Benefits', value: 100, amount: '$210,400' },
  { label: 'Software', value: 46, amount: '$96,210' },
  { label: 'Travel', value: 23, amount: '$48,900' },
];

/**
 * Composed acceptance check — assembles the library end-to-end into a full
 * spend-dashboard screen: AppShell owns tokens/theme/top bar, WindowFrame is
 * the browser chrome, and the body composes NavItem, Avatar, MoneyDisplay,
 * ProgressBar, AIInsightCard, and Button — zero per-page boilerplate.
 */
export const Loaded: Story = {
  render: () => (
    <AppShell title="Spend Dashboard">
      <WindowFrame url="app.clearline.com/dashboard">
        <div className="bg-cl-bg flex">
          <div className="border-cl-border bg-cl-surface flex w-52 flex-shrink-0 flex-col gap-0.75 border-r p-3">
            <NavItem icon="building" label="Dashboard" active />
            <NavItem icon="file-text" label="My Expenses" />
            <NavItem icon="check" label="Approvals" badge="7" />
            <NavItem icon="refresh" label="Reconciliation" />
            <div className="border-cl-border mt-auto flex items-center gap-2.5 border-t pt-2">
              <Avatar initials="MO" size={30} />
              <div className="min-w-0 flex-1">
                <div className="text-cl-text truncate text-xs font-semibold">Marcus Okafor</div>
                <div className="text-cl-text-3 text-[10.5px]">Finance Manager</div>
              </div>
            </div>
          </div>
          <div className="min-w-0 flex-1 p-6">
            <div className="mb-4.5 flex flex-wrap items-center justify-between gap-2.5">
              <div>
                <h3 className="text-cl-text m-0 mb-0.5 text-[19px] font-semibold">Spend overview</h3>
                <div className="text-cl-text-3 text-xs">All departments · June 2026</div>
              </div>
              <Button label="June 2026" variant="secondary" size="sm" icon="chevron-down" />
            </div>
            <div className="mb-4.5 grid grid-cols-4 gap-3.5">
              <div className="border-cl-border bg-cl-surface rounded-xl border p-4">
                <div className="text-cl-text-3 mb-2.5 text-[11.5px]">Total spend · June</div>
                <MoneyDisplay amount={487210.5} label="8.2% vs May" />
              </div>
              <div className="border-cl-border bg-cl-surface rounded-xl border p-4">
                <div className="text-cl-text-3 mb-1.75 text-[11.5px]">Pending approvals</div>
                <div className="font-mono text-[21px] font-semibold tabular-nums">7</div>
                <div className="text-cl-text-2 mt-1.5 text-[11px]">$48,210 awaiting</div>
              </div>
              <div className="border-cl-border bg-cl-surface rounded-xl border p-4">
                <div className="text-cl-text-3 mb-2.5 text-[11.5px]">Budget remaining</div>
                <MoneyDisplay amount={142000} derived />
              </div>
              <div className="border-cl-border bg-cl-surface rounded-xl border p-4">
                <div className="text-cl-text-3 mb-1.75 text-[11.5px]">Active cards</div>
                <div className="font-mono text-[21px] font-semibold tabular-nums">24</div>
                <div className="text-cl-text-2 mt-1.5 text-[11px]">3 frozen</div>
              </div>
            </div>
            <div className="grid grid-cols-[1.25fr_1fr] gap-3.5">
              <div className="border-cl-border bg-cl-surface rounded-xl border p-4.5">
                <div className="text-cl-text mb-4 text-[13px] font-semibold">Spend by category</div>
                <div className="flex flex-col gap-3">
                  {CATEGORIES.map((cat) => (
                    <div key={cat.label} className="flex items-center gap-2.75">
                      <span className="text-cl-text-2 w-30 flex-shrink-0 text-xs">{cat.label}</span>
                      <ProgressBar value={cat.value} />
                      <span className="font-mono w-19.5 flex-shrink-0 text-right text-xs font-semibold">
                        {cat.amount}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="border-cl-border bg-cl-surface rounded-xl border p-4.5">
                <div className="text-cl-text mb-3.5 text-[13px] font-semibold">Recent activity</div>
                <AIInsightCard
                  tone="anomaly"
                  title="WeWork · unusual amount"
                  body="Office · normally ~$11,000 this month."
                  confidence={87}
                  actionPrimary="Review"
                  actionSecondary="Dismiss"
                />
              </div>
            </div>
          </div>
        </div>
      </WindowFrame>
    </AppShell>
  ),
};

export const EmptyAndStale: Story = {
  render: () => (
    <AppShell title="Spend Dashboard">
      <div className="grid grid-cols-2 gap-5">
        <WindowFrame url="app.clearline.com/dashboard" size="sm">
          <div className="bg-cl-bg p-5">
            <h3 className="text-cl-text mb-4 text-base font-semibold">Spend overview</h3>
            <div className="border-cl-border bg-cl-surface rounded-xl border">
              <EmptyState
                icon="search"
                title="No transactions in this date range"
                body="Try widening the range or selecting a different period to see spend."
                action="Reset to June 2026"
              />
            </div>
          </div>
        </WindowFrame>
        <WindowFrame url="app.clearline.com/dashboard" size="sm">
          <div className="bg-cl-bg">
            <div className="p-3">
              <Alert tone="warning" title="Last updated 10 minutes ago" action="Refresh" />
            </div>
            <div className="grid grid-cols-3 gap-3 p-4">
              {['$487,210.50', '7', '24'].map((value, i) => (
                <div key={i} className="border-cl-border bg-cl-surface rounded-xl border p-3.5">
                  <div className="text-cl-text-3 mb-2 text-[11px]">{['Total · June', 'Pending', 'Cards'][i]}</div>
                  <div className="font-mono text-lg font-semibold tabular-nums">{value}</div>
                </div>
              ))}
            </div>
          </div>
        </WindowFrame>
      </div>
    </AppShell>
  ),
};
