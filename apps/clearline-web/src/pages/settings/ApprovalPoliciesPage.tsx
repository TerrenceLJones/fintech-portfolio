import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  AccessDenied,
  Button,
  ConfirmationDialog,
  PolicyRuleRow,
  POLICY_RULE_GRID,
  Select,
  Text,
  TextField,
  UnsavedChangesFooter,
} from '@clearline/ui';
import { SettingsForbiddenError, useSettingsSectionAccess } from '@clearline/data-access-settings';
import {
  IncoherentPolicyError,
  useApprovalPolicy,
  useUpdateApprovalPolicy,
} from '@clearline/data-access-policies';
import {
  DEFAULT_APPROVAL_TIERS,
  findOverlappingTier,
  formatTierIssue,
  formatTierRange,
  validateApprovalTiers,
} from '@clearline/domain-expenses';
import type { ApprovalPolicyTier, ApproverLevel } from '@clearline/contracts';
import { toMajorUnits, toMinorUnits } from '@clearline/money';
import { useDemoBeacon } from '@clearline/demo-beacon';
import { ToastViewport } from '../../components/ToastViewport';
import { useToast } from '../../hooks/useToast';
import { useRegisterNavigationGuard } from '../../hooks/navigation-guard-context';
import { DEFAULT_SETTINGS_SLUG, settingsPathForSlug } from '../../rbac/settings-sections';
import { approvalPoliciesBeacon } from './approval-policies.beacon';

const CARD = 'border-cl-border bg-cl-surface overflow-hidden rounded-xl border';

const APPROVER_OPTIONS: { value: ApproverLevel; label: string }[] = [
  { value: 'auto', label: 'Auto-approve' },
  { value: 'finance_manager', label: 'Finance Manager' },
  { value: 'controller', label: 'Controller' },
];

const APPROVER_LABEL: Record<ApproverLevel, string> = {
  auto: 'Auto-approve',
  finance_manager: 'Finance Manager',
  controller: 'Controller',
};

/** A tier as the page holds it while editing — a stable client id plus the tier fields. */
type EditableTier = ApprovalPolicyTier;

/** Currency-aware conversions for the major-unit inputs — never assume 2 decimals (JPY has 0, BHD 3). */
const minorToInput = (minor: number, currency: string): string =>
  String(toMajorUnits({ amountMinorUnits: minor, currency }));
const inputToMinor = (value: string, currency: string): number =>
  toMinorUnits(Number(value), currency);

/** A serialisable signature of the ladder, so dirty-tracking survives re-renders and reorders. */
function signature(tiers: ApprovalPolicyTier[]): string {
  return tiers.map((t) => `${t.minMinorUnits}:${t.maxMinorUnits}:${t.approver}`).join('|');
}

/**
 * Settings → Approval Policies (US-CW-037). Edits the approval-limit tier ladder that IS the model the
 * expense-routing logic consumes (AC-10) — there is no second copy. Tiers edit inline within the row
 * (design §19.7); the validator blocks a save with a gap or overlap and names the specific conflict
 * (AC-03/AC-04). Gated by `policies:manage`: the section probe degrades the whole page to AccessDenied
 * on an independent 403 even if the route guard were bypassed (AC-09).
 */
export function ApprovalPoliciesPage() {
  useDemoBeacon(approvalPoliciesBeacon);
  const navigate = useNavigate();
  const access = useSettingsSectionAccess('approval-policies');
  const { data: policy } = useApprovalPolicy();
  const updatePolicy = useUpdateApprovalPolicy();
  const { toast, show: showToast } = useToast(4000);

  const currency = policy?.currency ?? 'USD';
  const [tiers, setTiers] = useState<EditableTier[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [saveIssues, setSaveIssues] = useState<string[]>([]);
  // The first coverage gap found on save, so the page can offer a one-click "fill the gap" tier (AC-04).
  const [gapFill, setGapFill] = useState<{ fromMinorUnits: number; toMinorUnits: number } | null>(
    null,
  );
  const nextId = useRef(0);

  // Re-seed from the server copy on first load and after a successful save (the same reset-during-render
  // pattern the other settings pages use), keyed on the saved signature so an in-progress edit is safe.
  const savedKey = policy ? signature(policy.tiers) : '';
  const [syncedKey, setSyncedKey] = useState(savedKey);
  if (policy && savedKey !== syncedKey) {
    setSyncedKey(savedKey);
    setTiers(policy.tiers.map((t) => ({ ...t })));
    setEditingId(null);
    setSaveIssues([]);
    setGapFill(null);
  }

  const dirty = Boolean(policy && signature(tiers) !== signature(policy.tiers));
  useRegisterNavigationGuard(dirty || editingId !== null);
  useEffect(() => {
    if (!dirty) return;
    const handler = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  if (access.isError && access.error instanceof SettingsForbiddenError) {
    return (
      <AccessDenied
        message="Ask an admin if you need it. This settings section is available to a different role."
        requestLine="403 Forbidden · GET /api/settings/sections/approval-policies"
        actionLabel="Back to Personal Info"
        onAction={() => navigate(settingsPathForSlug(DEFAULT_SETTINGS_SLUG))}
      />
    );
  }

  if (!policy) {
    return (
      <Text as="p" tone="muted">
        Loading approval policies…
      </Text>
    );
  }

  const sorted = [...tiers].sort((a, b) => a.minMinorUnits - b.minMinorUnits);

  function beginEdit(id: string) {
    setEditingId(id);
    setSaveIssues([]);
  }

  function addTier() {
    const highestMax = sorted.reduce(
      (max, t) => (t.maxMinorUnits === null ? max : Math.max(max, t.maxMinorUnits)),
      -1,
    );
    const id = `new_${nextId.current++}`;
    // Seed one whole unit above the current ceiling so a new tier is unit-adjacent, not sub-unit-adjacent.
    const seededMin = highestMax >= 0 ? highestMax + toMinorUnits(1, currency) : 0;
    setTiers((prev) => [
      ...prev,
      { id, minMinorUnits: seededMin, maxMinorUnits: null, approver: 'finance_manager' },
    ]);
    setEditingId(id);
    setSaveIssues([]);
  }

  function deleteTier(id: string) {
    setTiers((prev) => prev.filter((t) => t.id !== id));
    if (editingId === id) setEditingId(null);
    setSaveIssues([]);
  }

  function commitRow(next: EditableTier) {
    setTiers((prev) => prev.map((t) => (t.id === next.id ? next : t)));
    setEditingId(null);
    setSaveIssues([]);
  }

  function cancelRow(id: string) {
    // A brand-new tier that was never committed is removed on cancel; an existing one just closes.
    if (id.startsWith('new_')) setTiers((prev) => prev.filter((t) => t.id !== id));
    setEditingId(null);
  }

  function handleReset() {
    setTiers(DEFAULT_APPROVAL_TIERS.map((t, index) => ({ ...t, id: `default_${index}` })));
    setEditingId(null);
    setSaveIssues([]);
    setConfirmReset(false);
  }

  /** Insert a tier spanning a coverage gap so the ladder becomes contiguous again (AC-04). */
  function fillGap(gap: { fromMinorUnits: number; toMinorUnits: number }) {
    const id = `new_${nextId.current++}`;
    setTiers((prev) => [
      ...prev,
      {
        id,
        minMinorUnits: gap.fromMinorUnits + toMinorUnits(1, currency),
        maxMinorUnits: gap.toMinorUnits - toMinorUnits(1, currency),
        approver: 'finance_manager',
      },
    ]);
    setGapFill(null);
    setSaveIssues([]);
    setEditingId(id);
  }

  function handleSave() {
    const validation = validateApprovalTiers(tiers);
    if (!validation.ok) {
      setSaveIssues(validation.issues.map((issue) => formatTierIssue(issue, currency)));
      const firstGap = validation.issues.find((issue) => issue.kind === 'gap');
      setGapFill(
        firstGap && firstGap.kind === 'gap'
          ? { fromMinorUnits: firstGap.fromMinorUnits, toMinorUnits: firstGap.toMinorUnits }
          : null,
      );
      return;
    }
    setSaveIssues([]);
    setGapFill(null);
    updatePolicy.mutate(
      {
        tiers: validation.tiers.map((t) => ({
          minMinorUnits: t.minMinorUnits,
          maxMinorUnits: t.maxMinorUnits,
          approver: t.approver,
        })),
      },
      {
        onSuccess: () => showToast('Approval policy updated'),
        onError: (error) => {
          if (error instanceof IncoherentPolicyError) setSaveIssues(error.issues);
          else showToast('Could not save the policy. Please try again.');
        },
      },
    );
  }

  function handleDiscard() {
    setTiers((policy?.tiers ?? []).map((t) => ({ ...t })));
    setEditingId(null);
    setSaveIssues([]);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <Text as="h2" size="heading">
            Approval Policies
          </Text>
          <Text as="p" size="label" tone="muted">
            Route each expense to the right approver by amount. Tiers must cover every amount from
            $0 up, with no gaps or overlaps.
          </Text>
        </div>
        <Button variant="secondary" size="sm" onClick={() => setConfirmReset(true)}>
          Reset to defaults
        </Button>
      </div>

      <section className={CARD}>
        <div
          className={`${POLICY_RULE_GRID} bg-cl-inset text-cl-text-3 border-cl-border border-b px-4 py-2.5 font-mono text-[10px] tracking-wide uppercase`}
        >
          <div>Amount Range</div>
          <div>Required Approver</div>
          <div className="text-right">Actions</div>
        </div>

        {sorted.map((tier) =>
          editingId === tier.id ? (
            <TierEditor
              key={tier.id}
              tier={tier}
              others={tiers.filter((t) => t.id !== tier.id)}
              currency={currency}
              onSave={commitRow}
              onCancel={() => cancelRow(tier.id)}
            />
          ) : (
            <PolicyRuleRow
              key={tier.id}
              rangeLabel={formatTierRange(tier, currency)}
              approverLabel={APPROVER_LABEL[tier.approver]}
              autoApprove={tier.approver === 'auto'}
              onEdit={() => beginEdit(tier.id)}
              onDelete={() => deleteTier(tier.id)}
              deletable={tiers.length > 1}
            />
          ),
        )}

        <div className="px-4 py-3">
          <Button variant="secondary" size="sm" onClick={addTier} disabled={editingId !== null}>
            + Add tier
          </Button>
        </div>
      </section>

      {saveIssues.length > 0 && (
        <div className="border-cl-neg bg-cl-neg-weak flex flex-col gap-2 rounded-lg border px-4 py-3">
          {saveIssues.map((issue) => (
            <Text as="p" key={issue} size="label" className="text-cl-neg">
              {issue}
            </Text>
          ))}
          {gapFill && (
            <div className="pt-1">
              <Button variant="secondary" size="sm" onClick={() => fillGap(gapFill)}>
                Add a tier to fill this gap
              </Button>
            </div>
          )}
        </div>
      )}

      <UnsavedChangesFooter
        visible={dirty && editingId === null}
        onSave={handleSave}
        onDiscard={handleDiscard}
        saving={updatePolicy.isPending}
      />

      <ConfirmationDialog
        open={confirmReset}
        onOpenChange={setConfirmReset}
        title="Reset to the default approval policy?"
        body="This replaces every tier with the default ladder: $0–$10,000 routes to a Finance Manager and anything above $10,000 routes to a Controller. All custom tiers are removed."
        confirmLabel="Reset to defaults"
        countdown={0}
        onConfirm={handleReset}
      />

      <ToastViewport toast={toast} />
    </div>
  );
}

interface TierEditorProps {
  tier: EditableTier;
  others: EditableTier[];
  currency: string;
  onSave: (tier: EditableTier) => void;
  onCancel: () => void;
}

/**
 * The inline row editor (design §19.7): amount min/max inputs, an "unlimited" toggle for the top tier,
 * the approver select, and Cancel/Save. It validates the draft against the other tiers as you type and
 * surfaces the specific overlap message (AC-03), disabling Save until the range is coherent.
 */
function TierEditor({ tier, others, currency, onSave, onCancel }: TierEditorProps) {
  const [minDollars, setMinDollars] = useState(minorToInput(tier.minMinorUnits, currency));
  const [unlimited, setUnlimited] = useState(tier.maxMinorUnits === null);
  const [maxDollars, setMaxDollars] = useState(
    tier.maxMinorUnits === null ? '' : minorToInput(tier.maxMinorUnits, currency),
  );
  const [approver, setApprover] = useState<ApproverLevel>(tier.approver);

  const minMinorUnits = inputToMinor(minDollars, currency);
  const maxMinorUnits = unlimited ? null : inputToMinor(maxDollars, currency);

  const minValid = Number.isFinite(minMinorUnits) && minMinorUnits >= 0 && minDollars.trim() !== '';
  const maxValid = unlimited || (Number.isFinite(maxMinorUnits) && maxDollars.trim() !== '');
  const rangeValid =
    minValid && maxValid && (maxMinorUnits === null || maxMinorUnits > minMinorUnits);

  const overlap = rangeValid
    ? findOverlappingTier({ minMinorUnits, maxMinorUnits }, others)
    : undefined;
  const error = !rangeValid
    ? 'Enter a valid range — the maximum must be greater than the minimum.'
    : overlap
      ? formatTierIssue({ kind: 'overlap', index: 0, withRange: overlap }, currency)
      : undefined;

  function save() {
    if (error) return;
    onSave({ ...tier, minMinorUnits, maxMinorUnits, approver });
  }

  return (
    <div className="bg-cl-accent-weak border-cl-border border-b px-4 py-3.5">
      <div className={`${POLICY_RULE_GRID}`}>
        <div className="flex items-center gap-2">
          <TextField
            aria-label="Tier minimum (dollars)"
            value={minDollars}
            onChange={(event) => setMinDollars(event.target.value)}
            inputMode="decimal"
          />
          <Text as="span" tone="muted">
            –
          </Text>
          <TextField
            aria-label="Tier maximum (dollars)"
            value={unlimited ? '' : maxDollars}
            onChange={(event) => setMaxDollars(event.target.value)}
            inputMode="decimal"
            disabled={unlimited}
            placeholder={unlimited ? 'Unlimited' : undefined}
          />
        </div>
        <Select
          aria-label="Required approver"
          value={approver}
          onValueChange={(value) => setApprover(value as ApproverLevel)}
          options={APPROVER_OPTIONS}
        />
        <div className="flex items-center justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" onClick={save} disabled={Boolean(error)}>
            Save
          </Button>
        </div>
      </div>

      <label className="text-cl-text-2 mt-2 flex w-fit items-center gap-2 text-[12px]">
        <input
          type="checkbox"
          checked={unlimited}
          onChange={(event) => setUnlimited(event.target.checked)}
        />
        No upper limit (top tier)
      </label>

      {error && (
        <Text as="p" size="label" className="text-cl-neg mt-2">
          {error}
        </Text>
      )}
    </div>
  );
}
