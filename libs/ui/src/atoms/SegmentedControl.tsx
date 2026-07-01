import { useState } from 'react';

export interface SegmentedControlProps {
  options: string[];
  value?: string;
  onChange?: (value: string) => void;
}

export function SegmentedControl({ options, value, onChange }: SegmentedControlProps) {
  const [internal, setInternal] = useState(value ?? options[0]);
  const active = value ?? internal;

  function select(option: string) {
    setInternal(option);
    onChange?.(option);
  }

  return (
    <div className="bg-cl-surface-2 border-cl-border inline-flex items-center gap-1.5 rounded-lg border p-0.75">
      {options.map((option) => {
        const on = option === active;
        return (
          <button
            key={option}
            type="button"
            aria-pressed={on}
            onClick={() => select(option)}
            className={[
              'rounded-md px-3.5 py-1.5 text-xs font-medium whitespace-nowrap',
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
