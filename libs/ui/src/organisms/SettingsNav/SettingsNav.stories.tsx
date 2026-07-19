import type { Meta, StoryObj } from '@storybook/react-vite';
import { SettingsNav, type SettingsNavGroup } from './SettingsNav';

const PROFILE_GROUP: SettingsNavGroup = {
  id: 'profile',
  label: 'Profile',
  items: [
    { id: 'personal', label: 'Personal Info', href: '/settings/personal' },
    { id: 'security', label: 'Security', href: '/settings/security' },
    { id: 'notifications', label: 'Notifications', href: '/settings/notifications' },
  ],
};

const ORGANIZATION_GROUP: SettingsNavGroup = {
  id: 'organization',
  label: 'Organization',
  items: [
    { id: 'company', label: 'Company Profile', href: '/settings/company' },
    { id: 'approval-policies', label: 'Approval Policies', href: '/settings/approval-policies' },
    { id: 'spend-controls', label: 'Spend Controls', href: '/settings/spend-controls' },
    { id: 'card-program', label: 'Card Program', href: '/settings/card-program' },
    { id: 'connected-accounts', label: 'Connected Accounts', href: '/settings/connected-accounts' },
    { id: 'integrations', label: 'Integrations', href: '/settings/integrations' },
    {
      id: 'org-notifications',
      label: 'Organization Notifications',
      href: '/settings/org-notifications',
    },
    {
      id: 'security-compliance',
      label: 'Security & Compliance',
      href: '/settings/security-compliance',
    },
    { id: 'developer', label: 'Developer', href: '/settings/developer' },
    { id: 'billing', label: 'Billing & Plan', href: '/settings/billing' },
  ],
};

const meta: Meta<typeof SettingsNav> = {
  title: 'Organisms/SettingsNav',
  component: SettingsNav,
  parameters: { layout: 'padded' },
  decorators: [
    (Story) => (
      <div className="bg-cl-surface border-cl-border max-w-xs rounded-xl border p-3">
        <Story />
      </div>
    ),
  ],
};
export default meta;

type Story = StoryObj<typeof SettingsNav>;

/** What an Employee sees: the Profile group only — the Organization group isn't rendered at all. */
export const EmployeeProfileOnly: Story = {
  args: { groups: [PROFILE_GROUP], activeId: 'personal' },
};

/** What a Controller (not Admin/Owner) sees: Profile plus the org-config sections, minus the
 *  Admin/Owner-only Security & Compliance, Developer and Billing entries. */
export const ControllerView: Story = {
  args: {
    groups: [
      PROFILE_GROUP,
      {
        ...ORGANIZATION_GROUP,
        items: ORGANIZATION_GROUP.items.filter(
          (item) => !['security-compliance', 'developer', 'billing'].includes(item.id),
        ),
      },
    ],
    activeId: 'company',
  },
};

/** What an Admin/Owner sees: every section across both tiers, Billing active. */
export const AdminOwnerFullAccess: Story = {
  args: { groups: [PROFILE_GROUP, ORGANIZATION_GROUP], activeId: 'billing' },
};
