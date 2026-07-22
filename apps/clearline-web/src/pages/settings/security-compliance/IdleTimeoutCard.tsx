import { useState } from 'react';
import { Button, Select, Text } from '@clearline/ui';
import type { IdleTimeoutMinutes, OrgSecurityResponse } from '@clearline/contracts';
import { IDLE_TIMEOUT_OPTIONS } from '@clearline/domain-org-security';
import { useSetIdleTimeout } from '@clearline/data-access-org-security';
import { CARD } from './card';

/**
 * Org idle session-timeout (US-CW-040 AC-05). The chosen duration is the single source the per-user
 * inactivity auto-logoff (US-CW-002) reads — every member's timer uses this value on their next session
 * check. Explicit Save so the change is deliberate.
 */
export function IdleTimeoutCard({
  posture,
  onToast,
}: {
  posture: OrgSecurityResponse;
  onToast: (message: string) => void;
}) {
  const setIdleTimeout = useSetIdleTimeout();
  const [selected, setSelected] = useState<number>(posture.idleTimeoutMinutes);

  const dirty = selected !== posture.idleTimeoutMinutes;

  function handleSave() {
    setIdleTimeout.mutate(selected as IdleTimeoutMinutes, {
      onSuccess: () => onToast('Idle session timeout updated'),
    });
  }

  return (
    <section className={`${CARD} flex flex-col gap-4`} aria-labelledby="timeout-heading">
      <div className="flex flex-col gap-1">
        <Text as="h3" id="timeout-heading" size="label" weight="semibold">
          Idle session timeout
        </Text>
        <Text as="p" tone="muted" size="label">
          Members are signed out automatically after this long without activity.
        </Text>
      </div>
      <div className="flex items-center gap-3">
        <Select
          aria-label="Idle session timeout"
          value={String(selected)}
          onValueChange={(value) => setSelected(Number(value))}
          options={IDLE_TIMEOUT_OPTIONS.map((option) => ({
            value: String(option.minutes),
            label: option.label,
          }))}
          className="w-48"
        />
        <Button
          variant="primary"
          onClick={handleSave}
          loading={setIdleTimeout.isPending}
          disabled={!dirty}
        >
          Save
        </Button>
      </div>
    </section>
  );
}
