import { useState } from 'react';
import type { NotificationFrequency } from '@clearline/contracts';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { NotificationToggle } from './NotificationToggle';

const meta: Meta<typeof NotificationToggle> = {
  title: 'Molecules/NotificationToggle',
  component: NotificationToggle,
};
export default meta;

type Story = StoryObj<typeof NotificationToggle>;

function Interactive(args: {
  label: string;
  description: string;
  supportsFrequency: boolean;
  email: boolean;
  inApp: boolean;
  frequency: NotificationFrequency;
}) {
  const [state, setState] = useState({
    email: args.email,
    inApp: args.inApp,
    frequency: args.frequency,
  });
  return (
    <div className="border-cl-border bg-cl-surface w-[560px] rounded-xl border">
      <NotificationToggle
        label={args.label}
        description={args.description}
        supportsFrequency={args.supportsFrequency}
        {...state}
        onChange={setState}
      />
    </div>
  );
}

export const BothChannelsOn: Story = {
  render: () => (
    <Interactive
      label="Expense approved"
      description="When an expense you submitted is approved"
      supportsFrequency
      email
      inApp
      frequency="instant"
    />
  ),
};

export const AllChannelsOff: Story = {
  render: () => (
    <Interactive
      label="Card transaction authorized"
      description="Every time one of your cards is charged"
      supportsFrequency
      email={false}
      inApp={false}
      frequency="instant"
    />
  ),
};

export const NonFrequencyType: Story = {
  render: () => (
    <Interactive
      label="Security alerts"
      description="New sign-ins and changes to your password or 2FA"
      supportsFrequency={false}
      email
      inApp
      frequency="instant"
    />
  ),
};
