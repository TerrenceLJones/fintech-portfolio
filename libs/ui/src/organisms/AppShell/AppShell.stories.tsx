import type { Meta, StoryObj } from '@storybook/react-vite';
import { MemoryRouter, Route, Routes } from 'react-router';
import { ThemeProvider } from '@clearline/design-tokens';
import { AppShell } from './AppShell';
import { MoneyDisplay } from '../../foundations/MoneyDisplay';
import { BudgetGauge } from '../../foundations/BudgetGauge';

const DASHBOARD_CONTENT = (
  <div className="grid grid-cols-2 gap-4">
    <div className="bg-cl-surface border-cl-border rounded-xl border p-5">
      <MoneyDisplay amount={487210.5} label="Total spend · June" />
    </div>
    <BudgetGauge label="Engineering" used={23000} total={50000} />
  </div>
);

const NAV_ITEMS = [
  { id: 'expenses', icon: 'file-text' as const, label: 'My Expenses' },
  { id: 'cards', icon: 'copy' as const, label: 'My Cards' },
];

const meta: Meta<typeof AppShell> = {
  title: 'Organisms/AppShell',
  component: AppShell,
  decorators: [
    (Story) => (
      <ThemeProvider>
        <MemoryRouter initialEntries={['/']}>
          <Routes>
            <Route element={<Story />}>
              <Route index element={DASHBOARD_CONTENT} />
            </Route>
          </Routes>
        </MemoryRouter>
      </ThemeProvider>
    ),
  ],
};
export default meta;

type Story = StoryObj<typeof AppShell>;

export const SpendDashboard: Story = {
  args: {
    title: 'Spend Dashboard',
    navItems: NAV_ITEMS,
    activeNavId: 'expenses',
    identity: {
      name: 'Marcus Okafor',
      initials: 'MO',
      roleLabel: 'Finance Manager',
      detail: '$10k limit',
    },
  },
};

export const IdentityLoading: Story = {
  args: {
    title: 'Spend Dashboard',
    navItems: NAV_ITEMS,
    activeNavId: 'expenses',
    identityLoading: true,
  },
};
