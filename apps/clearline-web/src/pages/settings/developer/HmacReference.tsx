import { useState } from 'react';
import { Icon, Text } from '@clearline/ui';
import { HMAC_VERIFICATION_SNIPPET } from '@clearline/domain-developer';

/**
 * A collapsible reference showing how to verify the `Clearline-Signature` header (AC-09): the static
 * HMAC-SHA256 Node snippet. Documentation only — Clearline never executes it; it hands integrators the
 * exact means to confirm an event is genuinely from Clearline.
 */
export function HmacReference() {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 text-left"
      >
        <Icon
          name="chevron-right"
          size={14}
          className={`text-cl-text-3 transition-transform ${open ? 'rotate-90' : ''}`}
        />
        <Text as="span" size="label" weight="semibold">
          Verify the Clearline-Signature header
        </Text>
      </button>
      {open ? (
        <pre className="bg-cl-inset text-cl-text mt-2 overflow-x-auto rounded-lg p-3 font-mono text-[11.5px] leading-relaxed">
          {HMAC_VERIFICATION_SNIPPET}
        </pre>
      ) : null}
    </div>
  );
}
