import { useRef } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { SpotlightCoachmark } from './SpotlightCoachmark';
import { alertingAction } from '../../storybook-actions';

const meta: Meta<typeof SpotlightCoachmark> = {
  title: 'Molecules/SpotlightCoachmark',
  component: SpotlightCoachmark,
};
export default meta;

type Story = StoryObj<typeof SpotlightCoachmark>;

/** The coachmark anchors to a real control, so the stories render one to point at. */
function AnchoredExample({ title, body }: { title: string; body: string }) {
  const anchorRef = useRef<HTMLButtonElement>(null);
  return (
    <div className="flex flex-col items-end gap-24 p-6">
      <button
        ref={anchorRef}
        className="bg-cl-accent rounded-lg px-4 py-2 font-semibold text-white"
      >
        New expense
      </button>
      <SpotlightCoachmark
        anchorRef={anchorRef}
        title={title}
        body={body}
        onDismiss={alertingAction('Dismiss spotlight')}
      />
    </div>
  );
}

export const NewExpense: Story = {
  render: () => (
    <AnchoredExample title="Start here" body="Log your first purchase and send it for approval." />
  ),
};

export const IssueCard: Story = {
  render: () => (
    <AnchoredExample title="Create your first card" body="Set its limit and who it's for." />
  ),
};
