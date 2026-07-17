import { useState } from 'react';

export interface SegmentedControlProps {
  options: string[];
  value?: string;
  onChange?: (value: string) => void;
  /** Stretch to the container width and split it evenly across the options — e.g. the theme toggle in the sidebar rail. */
  fullWidth?: boolean;
}

export function SegmentedControl({ options, value, onChange, fullWidth }: SegmentedControlProps) {
  const [internal, setInternal] = useState(value ?? options[0]);
  const active = value ?? internal;

  function select(option: string) {
    setInternal(option);
    onChange?.(option);
  }

  return (
    <div
      className={[
        'bg-cl-surface-2 border-cl-border items-center gap-1.5 rounded-lg border p-0.75',
        fullWidth ? 'flex w-full' : 'inline-flex',
      ].join(' ')}
    >
      {options.map((option) => {
        const on = option === active;
        return (
          <button
            key={option}
            type="button"
            aria-pressed={on}
            onClick={() => select(option)}
            className={[
              'cursor-pointer rounded-md px-3.5 py-1.5 text-xs font-medium whitespace-nowrap',
              fullWidth ? 'flex-1 text-center' : '',
              on ? 'bg-cl-surface text-cl-text shadow-sm' : 'text-cl-text-3',
            ].join(' ')}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}
