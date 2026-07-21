import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  AccessDenied,
  Alert,
  SegmentedControl,
  Text,
  TextField,
  UnsavedChangesFooter,
} from '@clearline/ui';
import { SettingsForbiddenError, useSettingsSectionAccess } from '@clearline/data-access-settings';
import {
  CardProgramUpdateError,
  useCardProgram,
  useUpdateCardProgram,
} from '@clearline/data-access-card-program';
import type { CardProgramDefaultsResponse, IssuancePolicy } from '@clearline/contracts';
import { toMajorUnits, toMinorUnits } from '@clearline/money';
import { useDemoBeacon } from '@clearline/demo-beacon';
import { ToastViewport } from '../../components/ToastViewport';
import { useToast } from '../../hooks/useToast';
import { useRegisterNavigationGuard } from '../../hooks/navigation-guard-context';
import { DEFAULT_SETTINGS_SLUG, settingsPathForSlug } from '../../rbac/settings-sections';
import { MccRestrictionPicker } from './card-program/MccRestrictionPicker';
import { cardProgramBeacon } from './card-program.beacon';

const CARD = 'border-cl-border bg-cl-surface rounded-xl border p-6';

const ISSUANCE_OPTIONS: { value: IssuancePolicy; label: string }[] = [
  { value: 'everyone', label: 'Everyone' },
  { value: 'managers_and_above', label: 'Finance Managers and above' },
];

const minorToInput = (minor: number, currency: string): string =>
  String(toMajorUnits({ amountMinorUnits: minor, currency }));

interface CardProgramForm {
  monthlyDollars: string;
  perTransactionDollars: string;
  allowedMccs: string[];
  issuancePolicy: IssuancePolicy;
}

function toForm(program: CardProgramDefaultsResponse): CardProgramForm {
  const { currency } = program;
  return {
    monthlyDollars: minorToInput(program.defaultMonthlyLimit.amountMinorUnits, currency),
    perTransactionDollars: minorToInput(
      program.defaultPerTransactionLimit.amountMinorUnits,
      currency,
    ),
    allowedMccs: [...program.defaultAllowedMccs],
    issuancePolicy: program.issuancePolicy,
  };
}

function signature(form: CardProgramForm): string {
  return [
    form.monthlyDollars,
    form.perTransactionDollars,
    [...form.allowedMccs].sort().join(','),
    form.issuancePolicy,
  ].join('|');
}

/**
 * Settings → Card Program (US-CW-038). Edits the org-wide defaults a newly issued virtual card inherits
 * — default monthly / per-transaction limits, MCC restrictions (searchable, AC-02), and who may request
 * a card (AC-03). Existing cards are never changed; only new issuance reads these (AC-01). Gated by
 * `card-program:manage` with a server-authoritative 403 (AC-09), edited behind the shared unsaved-changes
 * footer.
 */
export function CardProgramPage() {
  useDemoBeacon(cardProgramBeacon);
  const navigate = useNavigate();
  const access = useSettingsSectionAccess('card-program');
  const { data: program } = useCardProgram();
  const updateProgram = useUpdateCardProgram();
  const { toast, show: showToast } = useToast(4000);

  const [form, setForm] = useState<CardProgramForm>(() =>
    program
      ? toForm(program)
      : {
          monthlyDollars: '',
          perTransactionDollars: '',
          allowedMccs: [],
          issuancePolicy: 'everyone',
        },
  );

  const savedKey = program ? signature(toForm(program)) : '';
  const [syncedKey, setSyncedKey] = useState(savedKey);
  if (program && savedKey !== syncedKey) {
    setSyncedKey(savedKey);
    setForm(toForm(program));
  }

  const dirty = Boolean(program && signature(form) !== signature(toForm(program)));
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
        requestLine="403 Forbidden · GET /api/settings/sections/card-program"
        actionLabel="Back to Personal Info"
        onAction={() => navigate(settingsPathForSlug(DEFAULT_SETTINGS_SLUG))}
      />
    );
  }

  if (!program) {
    return (
      <Text as="p" tone="muted">
        Loading card program…
      </Text>
    );
  }

  function handleSave() {
    if (!program) return;
    const { currency } = program;
    updateProgram.mutate(
      {
        defaultMonthlyLimitMinorUnits: toMinorUnits(Number(form.monthlyDollars || '0'), currency),
        defaultPerTransactionLimitMinorUnits: toMinorUnits(
          Number(form.perTransactionDollars || '0'),
          currency,
        ),
        defaultAllowedMccs: form.allowedMccs,
        issuancePolicy: form.issuancePolicy,
      },
      { onSuccess: () => showToast('Card program updated') },
    );
  }

  function handleDiscard() {
    if (program) setForm(toForm(program));
  }

  function toggleMcc(code: string) {
    setForm((prev) => ({
      ...prev,
      allowedMccs: prev.allowedMccs.includes(code)
        ? prev.allowedMccs.filter((c) => c !== code)
        : [...prev.allowedMccs, code],
    }));
  }

  const issuanceLabel =
    ISSUANCE_OPTIONS.find((option) => option.value === form.issuancePolicy)?.label ?? 'Everyone';

  return (
    <div className="flex flex-col gap-6">
      <Text as="h2" size="heading">
        Card Program
      </Text>

      {/* Default limits (AC-01). */}
      <section className={`${CARD} flex flex-col gap-4`}>
        <Text as="h3" size="label" weight="semibold">
          Default limits for new cards
        </Text>
        <div className="flex flex-wrap gap-6">
          <div className="w-56">
            <TextField
              label="Default monthly limit"
              value={form.monthlyDollars}
              onChange={(event) => setForm((p) => ({ ...p, monthlyDollars: event.target.value }))}
              inputMode="decimal"
              prefix="$"
            />
          </div>
          <div className="w-56">
            <TextField
              label="Default per-transaction limit"
              value={form.perTransactionDollars}
              onChange={(event) =>
                setForm((p) => ({ ...p, perTransactionDollars: event.target.value }))
              }
              inputMode="decimal"
              prefix="$"
            />
          </div>
        </div>
        <Text as="p" size="label" tone="faint">
          Existing cards are not affected. You can customize limits per card after issuance.
        </Text>
      </section>

      {/* MCC restrictions (AC-02). */}
      <section className={`${CARD} flex flex-col gap-4`}>
        <Text as="h3" size="label" weight="semibold">
          Default merchant-category restrictions
        </Text>
        <MccRestrictionPicker
          catalogue={program.merchantCategories}
          selected={form.allowedMccs}
          onToggle={toggleMcc}
        />
      </section>

      {/* Issuance policy (AC-03). */}
      <section className={`${CARD} flex flex-col gap-3`}>
        <Text as="h3" size="label" weight="semibold">
          Who can request a new card
        </Text>
        <SegmentedControl
          options={ISSUANCE_OPTIONS.map((option) => option.label)}
          value={issuanceLabel}
          onChange={(label) =>
            setForm((p) => ({
              ...p,
              issuancePolicy:
                ISSUANCE_OPTIONS.find((option) => option.label === label)?.value ?? 'everyone',
            }))
          }
        />
        <Text as="p" size="label" tone="faint">
          Controls who sees the “Request a card” action. Only a Finance Manager or Controller ever
          issues the card itself.
        </Text>
      </section>

      {updateProgram.error instanceof CardProgramUpdateError ? (
        <Alert
          tone="negative"
          title="Couldn’t save the card program"
          message="Enter positive limits, and keep the per-transaction limit at or below the monthly limit."
        />
      ) : null}

      <UnsavedChangesFooter
        visible={dirty}
        onSave={handleSave}
        onDiscard={handleDiscard}
        saving={updateProgram.isPending}
      />

      <ToastViewport toast={toast} />
    </div>
  );
}
