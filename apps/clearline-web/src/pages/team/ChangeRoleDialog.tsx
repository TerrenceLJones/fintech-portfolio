import { useId, useState } from 'react';
import type { Role } from '@clearline/contracts';
import { Button, Checkbox, Modal, SegmentedControl, Text } from '@clearline/ui';
import { roleLabel } from '../../rbac/identity';

export interface ChangeRoleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  memberName: string;
  currentRole: Role;
  currentIsAdmin: boolean;
  /** True only for the Owner — the sole role that may REVOKE Admin (US-CW-031 AC-08). */
  canRevokeAdmin: boolean;
  onConfirm: (role: Role, grantAdmin: boolean) => void;
  submitting?: boolean;
}

const ROLE_BY_LABEL: Record<string, Role> = {
  Employee: 'employee',
  'Finance Manager': 'finance_manager',
  Controller: 'controller',
};
const ROLE_LABELS = Object.keys(ROLE_BY_LABEL);

/**
 * Change a member's approval tier and/or the orthogonal Admin permission (Design §18.4, US-CW-031
 * AC-04/AC-08). Takes effect on the member's next request, and the server records each change as an
 * audit event. Reversible, so — unlike the money-movement ConfirmationDialog — there's no countdown.
 * Revoking Admin is Owner-only: for anyone else the Admin checkbox of an already-Admin member is
 * locked on (the client half of the server's owner-only-revoke rule).
 */
export function ChangeRoleDialog({
  open,
  onOpenChange,
  memberName,
  currentRole,
  currentIsAdmin,
  canRevokeAdmin,
  onConfirm,
  submitting = false,
}: ChangeRoleDialogProps) {
  const [selectedLabel, setSelectedLabel] = useState<string>(roleLabel(currentRole));
  const [grantAdmin, setGrantAdmin] = useState(currentIsAdmin);
  const [prevOpen, setPrevOpen] = useState(open);
  const adminLabelId = useId();

  // Reset to the member's current tier + Admin state on each open transition.
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setSelectedLabel(roleLabel(currentRole));
      setGrantAdmin(currentIsAdmin);
    }
  }

  const selectedRole = ROLE_BY_LABEL[selectedLabel] ?? currentRole;
  // Only the Owner may turn an existing Admin off; everyone else sees it locked on.
  const adminLocked = currentIsAdmin && !canRevokeAdmin;
  const unchanged = selectedRole === currentRole && grantAdmin === currentIsAdmin;

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <Modal.Title asChild>
        <Text as="h2" size="heading" tone="default" className="mb-1">
          Change {memberName}’s access?
        </Text>
      </Modal.Title>
      <Modal.Description asChild>
        <Text as="p" size="label" tone="muted" className="mb-3.5">
          Takes effect on their next request. An audit event records the prior value, new value,
          actor and timestamp.
        </Text>
      </Modal.Description>

      <Text as="span" size="label" weight="medium" tone="muted" className="mb-2 block">
        Approval tier
      </Text>
      <div className="mb-3.5">
        <SegmentedControl
          options={ROLE_LABELS}
          value={selectedLabel}
          onChange={setSelectedLabel}
          fullWidth
        />
      </div>

      <label className="border-cl-border mb-4.5 flex items-start gap-2.5 rounded-lg border px-3 py-2.5">
        <span className="mt-0.5 shrink-0">
          <Checkbox
            checked={grantAdmin}
            disabled={adminLocked}
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
            Admin
          </Text>
          <Text as="span" size="label" tone="faint">
            {adminLocked
              ? 'Only the owner can revoke Admin.'
              : 'Team management (invite, change role, remove). Independent of the approval tier.'}
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
          disabled={unchanged || submitting}
          onClick={() => onConfirm(selectedRole, grantAdmin)}
        >
          Save changes
        </Button>
      </div>
    </Modal>
  );
}
