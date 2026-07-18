import { useId, useState } from 'react';
import type { Role } from '@clearline/contracts';
import { Button, Checkbox, Modal, SegmentedControl, Text, TextField } from '@clearline/ui';

export interface InviteMemberValues {
  email: string;
  role: Role;
  grantAdmin: boolean;
}

export interface InviteMemberModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: InviteMemberValues) => void;
  submitting?: boolean;
}

const ROLE_OPTIONS: { label: string; value: Role }[] = [
  { label: 'Employee', value: 'employee' },
  { label: 'Finance Manager', value: 'finance_manager' },
  { label: 'Controller', value: 'controller' },
];

const ROLE_LABELS = ROLE_OPTIONS.map((option) => option.label);

/**
 * Invite a teammate by work email with an approval-tier role, and optionally grant the orthogonal
 * Admin permission (Design §18.2). Admin is presented as a separate permission, not a fourth tier —
 * matching how the domain models it (US-CW-006 AC-08). The response is enumeration-safe, so this modal
 * never reveals whether the email already had an account.
 */
export function InviteMemberModal({
  open,
  onOpenChange,
  onSubmit,
  submitting = false,
}: InviteMemberModalProps) {
  const [email, setEmail] = useState('');
  const [roleLabel, setRoleLabel] = useState<string>('Finance Manager');
  const [grantAdmin, setGrantAdmin] = useState(false);
  const [prevOpen, setPrevOpen] = useState(open);
  const adminLabelId = useId();

  // Clear the form on each open transition so a prior draft never leaks into the next invite.
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setEmail('');
      setRoleLabel('Finance Manager');
      setGrantAdmin(false);
    }
  }

  const role =
    ROLE_OPTIONS.find((option) => option.label === roleLabel)?.value ?? 'finance_manager';
  const canSubmit = email.trim().length > 0 && !submitting;

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <Modal.Title asChild>
        <Text as="h2" size="heading" tone="default" className="mb-4">
          Invite a teammate
        </Text>
      </Modal.Title>

      <div className="mb-3.5">
        <TextField
          label="Work email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="teammate@company.com"
          autoComplete="off"
          required
        />
      </div>

      <Text as="span" size="label" weight="medium" tone="muted" className="mb-2 block">
        Role
      </Text>
      <div className="mb-3.5">
        <SegmentedControl
          options={ROLE_LABELS}
          value={roleLabel}
          onChange={setRoleLabel}
          fullWidth
        />
      </div>

      <label className="border-cl-border mb-4.5 flex items-start gap-2.5 rounded-lg border px-3 py-2.5">
        <span className="mt-0.5 shrink-0">
          <Checkbox
            checked={grantAdmin}
            onCheckedChange={setGrantAdmin}
            aria-labelledby={adminLabelId}
          />
        </span>
        <span className="min-w-0 flex-1">
          <Text
            as="span"
            id={adminLabelId}
            size="label"
            weight="medium"
            tone="default"
            className="block"
          >
            Also grant Admin
          </Text>
          <Text as="span" size="label" tone="faint">
            Team management (invite, change role, remove). Independent of the approval tier.
          </Text>
        </span>
      </label>

      <div className="flex gap-2.5">
        <Modal.Close asChild>
          <button
            type="button"
            className="border-cl-border-2 bg-cl-surface text-cl-text-2 flex-1 rounded-lg border px-4 py-2.5 text-[13px] font-medium"
          >
            Cancel
          </button>
        </Modal.Close>
        <Button
          fullWidth
          loading={submitting}
          disabled={!canSubmit}
          onClick={() => onSubmit({ email: email.trim(), role, grantAdmin })}
        >
          Send invite
        </Button>
      </div>
    </Modal>
  );
}
