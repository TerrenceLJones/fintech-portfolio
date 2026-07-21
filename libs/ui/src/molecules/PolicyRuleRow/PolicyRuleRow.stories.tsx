import type { Meta, StoryObj } from '@storybook/react-vite';
import { PolicyRuleRow, POLICY_RULE_GRID } from './PolicyRuleRow';

const meta: Meta<typeof PolicyRuleRow> = {
  title: 'Molecules/PolicyRuleRow',
  component: PolicyRuleRow,
};
export default meta;

type Story = StoryObj<typeof PolicyRuleRow>;

/** A framed table so the row reads in the context it ships in (design §19.7). */
function Table({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-cl-border bg-cl-surface w-[620px] overflow-hidden rounded-xl border">
      <div
        className={`${POLICY_RULE_GRID} bg-cl-inset text-cl-text-3 border-cl-border border-b px-4 py-2.5 font-mono text-[10px] tracking-wide uppercase`}
      >
        <div>Amount Range</div>
        <div>Required Approver</div>
        <div className="text-right">Actions</div>
      </div>
      {children}
    </div>
  );
}

export const Ladder: Story = {
  render: () => (
    <Table>
      <PolicyRuleRow
        rangeLabel="$0 – $999"
        approverLabel="Auto-approve"
        autoApprove
        onEdit={() => {}}
      />
      <PolicyRuleRow
        rangeLabel="$1,000 – $10,000"
        approverLabel="Finance Manager"
        onEdit={() => {}}
        onDelete={() => {}}
      />
      <PolicyRuleRow
        rangeLabel="$10,000+"
        approverLabel="Controller"
        onEdit={() => {}}
        onDelete={() => {}}
      />
    </Table>
  ),
};

export const SingleTierNotDeletable: Story = {
  render: () => (
    <Table>
      <PolicyRuleRow
        rangeLabel="$0+"
        approverLabel="Controller"
        onEdit={() => {}}
        onDelete={() => {}}
        deletable={false}
      />
    </Table>
  ),
};
