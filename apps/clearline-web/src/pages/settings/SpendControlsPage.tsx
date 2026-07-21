import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  AccessDenied,
  Button,
  ConfirmationDialog,
  Select,
  Text,
  TextField,
  UnsavedChangesFooter,
} from '@clearline/ui';
import { SettingsForbiddenError, useSettingsSectionAccess } from '@clearline/data-access-settings';
import { useSpendControls, useUpdateSpendControls } from '@clearline/data-access-policies';
import type { OutOfPolicyBehavior, SpendControlsResponse } from '@clearline/contracts';
import { toMajorUnits, toMinorUnits } from '@clearline/money';
import { useDemoBeacon } from '@clearline/demo-beacon';
import { ToastViewport } from '../../components/ToastViewport';
import { useToast } from '../../hooks/useToast';
import { useRegisterNavigationGuard } from '../../hooks/navigation-guard-context';
import { DEFAULT_SETTINGS_SLUG, settingsPathForSlug } from '../../rbac/settings-sections';
import { spendControlsBeacon } from './spend-controls.beacon';

const CARD = 'border-cl-border bg-cl-surface rounded-xl border p-6';

const BEHAVIOR_OPTIONS: { value: OutOfPolicyBehavior; label: string }[] = [
  { value: 'flag', label: 'Allow with a warning (flag for review)' },
  { value: 'block', label: 'Block entirely' },
];

/** Currency-aware conversions for the major-unit inputs — never assume 2 decimals (JPY has 0, BHD 3). */
const minorToInput = (minor: number, currency: string): string =>
  String(toMajorUnits({ amountMinorUnits: minor, currency }));
const inputToMinor = (value: string, currency: string): number =>
  toMinorUnits(Number(value), currency);

/** A per-category cap in the form: `dollars === null` means unlimited (no cap). */
interface CapField {
  categoryId: string;
  label: string;
  dollars: string | null;
}

interface SpendControlsForm {
  receiptDollars: string;
  memoDollars: string;
  behavior: OutOfPolicyBehavior;
  caps: CapField[];
}

function toForm(controls: SpendControlsResponse): SpendControlsForm {
  const { currency } = controls;
  return {
    receiptDollars: minorToInput(controls.receiptRequiredThresholdMinorUnits, currency),
    // A 0 threshold means "no memo requirement"; show it as empty rather than "$0".
    memoDollars:
      controls.memoRequiredThresholdMinorUnits > 0
        ? minorToInput(controls.memoRequiredThresholdMinorUnits, currency)
        : '',
    behavior: controls.outOfPolicyBehavior,
    caps: controls.categoryCaps.map((cap) => ({
      categoryId: cap.categoryId,
      label: cap.label,
      dollars:
        cap.monthlyLimitMinorUnits === null
          ? null
          : minorToInput(cap.monthlyLimitMinorUnits, currency),
    })),
  };
}

function signature(form: SpendControlsForm): string {
  return [
    form.receiptDollars,
    form.memoDollars,
    form.behavior,
    form.caps.map((c) => `${c.categoryId}:${c.dollars}`).join(','),
  ].join('|');
}

/**
 * Settings → Spend Controls (US-CW-037). Edits the receipt/memo thresholds, out-of-policy behavior, and
 * per-category monthly caps that the expense-submission gate enforces (AC-06/07/08) — the same policy
 * model, not a copy. Turning on "Block entirely" is consequential, so it confirms first and spells out
 * the consequence (AC-07). Gated by `policies:manage` with a server-authoritative 403 (AC-09).
 */
export function SpendControlsPage() {
  useDemoBeacon(spendControlsBeacon);
  const navigate = useNavigate();
  const access = useSettingsSectionAccess('spend-controls');
  const { data: controls } = useSpendControls();
  const updateControls = useUpdateSpendControls();
  const { toast, show: showToast } = useToast(4000);

  const [form, setForm] = useState<SpendControlsForm>(() =>
    controls
      ? toForm(controls)
      : { receiptDollars: '', memoDollars: '', behavior: 'flag', caps: [] },
  );
  const [confirmBlock, setConfirmBlock] = useState(false);

  const savedKey = controls ? signature(toForm(controls)) : '';
  const [syncedKey, setSyncedKey] = useState(savedKey);
  if (controls && savedKey !== syncedKey) {
    setSyncedKey(savedKey);
    setForm(toForm(controls));
  }

  const dirty = Boolean(controls && signature(form) !== signature(toForm(controls)));
  useRegisterNavigationGuard(dirty);
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
        requestLine="403 Forbidden · GET /api/settings/sections/spend-controls"
        actionLabel="Back to Personal Info"
        onAction={() => navigate(settingsPathForSlug(DEFAULT_SETTINGS_SLUG))}
      />
    );
  }

  if (!controls) {
    return (
      <Text as="p" tone="muted">
        Loading spend controls…
      </Text>
    );
  }

  function doSave() {
    if (!controls) return;
    setConfirmBlock(false);
    const { currency } = controls;
    updateControls.mutate(
      {
        receiptRequiredThresholdMinorUnits: inputToMinor(form.receiptDollars || '0', currency),
        memoRequiredThresholdMinorUnits: form.memoDollars.trim()
          ? inputToMinor(form.memoDollars, currency)
          : 0,
        outOfPolicyBehavior: form.behavior,
        categoryCaps: form.caps.map((cap) => ({
          categoryId: cap.categoryId,
          monthlyLimitMinorUnits: cap.dollars === null ? null : inputToMinor(cap.dollars, currency),
        })),
      },
      { onSuccess: () => showToast('Spend controls updated') },
    );
  }

  function handleSave() {
    // Newly turning on "Block entirely" is consequential — confirm and name the consequence first (AC-07).
    if (controls && form.behavior === 'block' && controls.outOfPolicyBehavior !== 'block') {
      setConfirmBlock(true);
      return;
    }
    doSave();
  }

  function handleDiscard() {
    if (controls) setForm(toForm(controls));
  }

  function setCap(categoryId: string, dollars: string | null) {
    setForm((prev) => ({
      ...prev,
      caps: prev.caps.map((cap) => (cap.categoryId === categoryId ? { ...cap, dollars } : cap)),
    }));
  }

  return (
    <div className="flex flex-col gap-6">
      <Text as="h2" size="heading">
        Spend Controls
      </Text>

      {/* Documentation thresholds (AC-06). */}
      <section className={`${CARD} flex flex-col gap-4`}>
        <Text as="h3" size="label" weight="semibold">
          Documentation requirements
        </Text>
        <div className="flex flex-wrap gap-6">
          <div className="w-56">
            <TextField
              label="Receipt required for expenses over"
              value={form.receiptDollars}
              onChange={(event) => setForm((p) => ({ ...p, receiptDollars: event.target.value }))}
              inputMode="decimal"
              prefix="$"
            />
          </div>
          <div className="w-56">
            <TextField
              label="Memo required for expenses over"
              value={form.memoDollars}
              onChange={(event) => setForm((p) => ({ ...p, memoDollars: event.target.value }))}
              inputMode="decimal"
              prefix="$"
              placeholder="No memo required"
            />
          </div>
        </div>
        <Text as="p" size="label" tone="faint">
          Leave the memo field empty to require no memo. Both thresholds are enforced when an
          expense is submitted.
        </Text>
      </section>

      {/* Out-of-policy behavior (AC-07). */}
      <section className={`${CARD} flex flex-col gap-3`}>
        <Text as="h3" size="label" weight="semibold">
          Out-of-policy expenses
        </Text>
        <div className="w-96 max-w-full">
          <Select
            aria-label="Out-of-policy behavior"
            value={form.behavior}
            onValueChange={(value) =>
              setForm((p) => ({ ...p, behavior: value as OutOfPolicyBehavior }))
            }
            options={BEHAVIOR_OPTIONS}
          />
        </div>
        <Text as="p" size="label" tone="faint">
          Applies when an expense exceeds its category’s per-transaction limit. “Allow with a
          warning” flags it for extra scrutiny; “Block entirely” prevents the submission outright.
        </Text>
      </section>

      {/* Per-category monthly caps (AC-08). */}
      <section className={`${CARD} flex flex-col gap-4`}>
        <Text as="h3" size="label" weight="semibold">
          Monthly category caps
        </Text>
        <div className="flex flex-col gap-3">
          {form.caps.map((cap) => (
            <div key={cap.categoryId} className="flex items-center gap-4">
              <Text as="span" className="w-32 text-[13px]">
                {cap.label}
              </Text>
              {cap.dollars === null ? (
                <>
                  <Text as="span" tone="muted" className="text-[13px]">
                    Unlimited
                  </Text>
                  <Button variant="secondary" size="sm" onClick={() => setCap(cap.categoryId, '')}>
                    Set a limit
                  </Button>
                </>
              ) : (
                <>
                  <div className="w-40">
                    <TextField
                      aria-label={`Monthly cap for ${cap.label}`}
                      value={cap.dollars}
                      onChange={(event) => setCap(cap.categoryId, event.target.value)}
                      inputMode="decimal"
                      prefix="$"
                    />
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setCap(cap.categoryId, null)}
                  >
                    Restore unlimited
                  </Button>
                </>
              )}
            </div>
          ))}
        </div>
        <Text as="p" size="label" tone="faint">
          A capped category blocks a submission that would push the submitter’s month-to-date spend
          over the limit. Historical spend already over a new cap is not retroactively invalidated.
        </Text>
      </section>

      <UnsavedChangesFooter
        visible={dirty}
        onSave={handleSave}
        onDiscard={handleDiscard}
        saving={updateControls.isPending}
      />

      <ConfirmationDialog
        open={confirmBlock}
        onOpenChange={setConfirmBlock}
        title="Block all out-of-policy expenses?"
        body="Setting this to Block entirely will prevent any out-of-policy expense submission. Employees will not be able to submit expenses that exceed policy limits."
        confirmLabel="Block entirely"
        countdown={0}
        onConfirm={doSave}
      />

      <ToastViewport toast={toast} />
    </div>
  );
}
