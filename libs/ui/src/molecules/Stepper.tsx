import { Icon } from '@fintech-portfolio/icons';

export interface StepperProps {
  steps: string[];
  /** Zero-based index of the current (in-progress) step. Earlier steps render as done. */
  current: number;
}

export function Stepper({ steps, current }: StepperProps) {
  return (
    <div className="flex items-start gap-2 font-sans">
      {steps.map((label, i) => {
        const done = i < current;
        const isCurrent = i === current;

        return (
          <div key={label} className="contents">
            <div className="flex flex-shrink-0 flex-col items-center gap-1.5">
              <span
                className={[
                  'flex h-6 w-6 items-center justify-center rounded-full box-border text-[11px] font-semibold',
                  done
                    ? 'bg-cl-accent text-white'
                    : isCurrent
                      ? 'bg-cl-surface text-cl-accent border-cl-accent border-2'
                      : 'bg-cl-surface text-cl-text-3 border-cl-border-2 border-2',
                ].join(' ')}
              >
                {done ? <Icon name="check" size={12} stroke={2.4} color="white" /> : i + 1}
              </span>
              <span
                className={`text-[11px] whitespace-nowrap ${isCurrent ? 'text-cl-text font-semibold' : 'text-cl-text-3 font-medium'}`}
              >
                {label}
              </span>
            </div>
            {i < steps.length - 1 ? (
              <span
                className={`mt-3 h-0.5 flex-1 rounded-full ${done ? 'bg-cl-accent' : 'bg-cl-border'}`}
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
