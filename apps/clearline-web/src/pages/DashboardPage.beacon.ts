import type { QueryClient } from '@tanstack/react-query';
import type { DemoBeaconPageConfig } from '@clearline/demo-beacon';
import type { Role } from '@clearline/contracts';
import { DEMO_EMAIL, loadControls } from '../dev/beacon/shared';
import { resetSection } from '../dev/beacon/global.beacon';

interface RolePreset {
  label: string;
  description: string;
  patch: { role: Role; approvalLimit: number | null; isAdmin: boolean };
}

const ROLE_PRESETS: RolePreset[] = [
  {
    label: 'Become Employee',
    description: 'Minimal shell — no approvals, no payments.',
    patch: { role: 'employee', approvalLimit: 0, isAdmin: false },
  },
  {
    label: 'Become Finance Manager',
    description: 'The default demo shell — $10,000 approval limit.',
    patch: { role: 'finance_manager', approvalLimit: 1_000_000, isAdmin: false },
  },
  {
    label: 'Become Controller',
    description: 'Full shell — unlimited approvals, admin, every nav section.',
    patch: { role: 'controller', approvalLimit: null, isAdmin: true },
  },
];

/**
 * Dashboard guide. The role-switch actions reassign the signed-in demo account in place, then
 * invalidate every query so the role-scoped nav re-scopes on the next session refetch — no re-login.
 */
export function buildDashboardBeacon(queryClient: QueryClient): DemoBeaconPageConfig {
  return {
    pageId: 'dashboard',
    title: 'Dashboard',
    summary:
      'The role-scoped shell. Switch roles to watch the nav and features change without re-login.',
    sections: [
      {
        kind: 'actions',
        title: 'Switch role (US-CW-006)',
        actions: ROLE_PRESETS.map((preset) => ({
          id: preset.patch.role,
          label: preset.label,
          description: preset.description,
          run: async () => {
            const { simulateRoleChangeForE2E } = await loadControls();
            simulateRoleChangeForE2E(DEMO_EMAIL, preset.patch);
            await queryClient.invalidateQueries();
          },
        })),
      },
      {
        kind: 'flows',
        title: 'Where to go',
        flows: [
          {
            id: 'tour',
            title: 'Take the tour',
            steps: [
              { text: 'Review the approvals queue.', navigateTo: '/approvals' },
              { text: 'Send a payment.', navigateTo: '/payments/new' },
              { text: 'Open a settled payment.', navigateTo: '/payments/pi_settled' },
            ],
          },
        ],
      },
      resetSection,
    ],
  };
}
