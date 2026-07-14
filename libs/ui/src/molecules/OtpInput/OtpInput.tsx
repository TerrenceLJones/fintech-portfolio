import { useId, useRef, type ClipboardEvent, type KeyboardEvent } from 'react';
import { Text } from '../../atoms/Text';

export type OtpInputState = 'default' | 'error';

export interface OtpInputProps {
  /** The current code, controlled by the caller. Only digits, up to `length` characters. */
  value: string;
  onChange: (value: string) => void;
  /** Fired once the code reaches `length` digits — the cue to auto-submit the challenge. */
  onComplete?: (value: string) => void;
  /** Number of digits. @default 6 */
  length?: number;
  label?: string;
  state?: OtpInputState;
  disabled?: boolean;
  autoFocus?: boolean;
}

/** Keeps only digits and truncates to `max` — the single place raw input is sanitized. */
function sanitize(raw: string, max: number): string {
  return raw.replace(/\D/g, '').slice(0, max);
}

/**
 * A segmented one-time-code entry (US-CW-010): `length` single-digit cells that read as one field. The
 * value is fully controlled — the caller owns the string — while focus advances on entry and steps back
 * on backspace, and a pasted code is sanitized and distributed across the cells. In the error state
 * every cell is flagged invalid so a wrong code reads unambiguously (AC-04).
 */
export function OtpInput({
  value,
  onChange,
  onComplete,
  length = 6,
  label,
  state = 'default',
  disabled = false,
  autoFocus = false,
}: OtpInputProps) {
  const groupId = useId();
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const isError = state === 'error';

  const focusCell = (index: number) => {
    const clamped = Math.max(0, Math.min(index, length - 1));
    refs.current[clamped]?.focus();
    refs.current[clamped]?.select();
  };

  const commit = (next: string) => {
    onChange(next);
    if (next.length === length) onComplete?.(next);
  };

  const handleKeyDown = (index: number) => (event: KeyboardEvent<HTMLInputElement>) => {
    if (/^\d$/.test(event.key)) {
      event.preventDefault();
      // Clamp the write position to the end of the current value so cells can't be filled out of order,
      // which would leave gaps in the code.
      const at = Math.min(index, value.length);
      const next = sanitize(value.slice(0, at) + event.key + value.slice(at + 1), length);
      commit(next);
      focusCell(at + 1);
      return;
    }
    if (event.key === 'Backspace') {
      event.preventDefault();
      if (index >= value.length) {
        // Empty cell: delete the last entered digit and step back.
        commit(value.slice(0, -1));
        focusCell(value.length - 1);
      } else {
        commit(value.slice(0, index) + value.slice(index + 1));
      }
      return;
    }
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      focusCell(index - 1);
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      focusCell(index + 1);
    }
  };

  const handlePaste = (event: ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    const next = sanitize(event.clipboardData.getData('text'), length);
    commit(next);
    focusCell(next.length);
  };

  const cellClasses = [
    'h-[42px] w-[34px] rounded-lg border text-center font-mono text-[17px] font-semibold outline-none',
    'text-cl-text bg-cl-surface',
    isError
      ? 'border-cl-neg text-cl-neg'
      : 'border-cl-border-2 focus:border-cl-accent focus:ring-3 focus:ring-cl-accent-weak',
    disabled ? 'opacity-60' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div>
      {label ? (
        <Text as="div" id={groupId} size="label" tone="muted" className="mb-1.5">
          {label}
        </Text>
      ) : null}
      <div
        className="flex justify-center gap-1.75"
        role="group"
        aria-labelledby={label ? groupId : undefined}
      >
        {Array.from({ length }, (_, index) => (
          <input
            key={index}
            ref={(el) => {
              refs.current[index] = el;
            }}
            type="text"
            inputMode="numeric"
            autoComplete={index === 0 ? 'one-time-code' : 'off'}
            autoFocus={autoFocus && index === 0}
            maxLength={1}
            value={value[index] ?? ''}
            disabled={disabled}
            aria-invalid={isError}
            aria-label={`${label ?? 'Code'} digit ${index + 1}`}
            onChange={() => {
              /* Entry is driven through onKeyDown/onPaste so the controlled value stays canonical. */
            }}
            onKeyDown={handleKeyDown(index)}
            onPaste={handlePaste}
            className={cellClasses}
          />
        ))}
      </div>
    </div>
  );
}
