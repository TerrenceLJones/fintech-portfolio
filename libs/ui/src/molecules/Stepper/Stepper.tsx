import { Icon } from '@fintech-portfolio/icons';
import { Text } from '../../atoms/Text';

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
              <Text
                as="span"
                size="label"
                weight="semibold"
                className={[
                  'flex h-6 w-6 items-center justify-center rounded-full box-border',
                  done
                    ? 'bg-cl-accent text-white'
                    : isCurrent
                      ? 'bg-cl-surface text-cl-accent border-cl-accent border-2'
                      : 'bg-cl-surface text-cl-text-3 border-cl-border-2 border-2',
                ].join(' ')}
              >
                {done ? <Icon name="check" size={12} stroke={2.4} color="white" /> : i + 1}
              </Text>
              <Text
                as="span"
                size="label"
                weight={isCurrent ? 'semibold' : 'medium'}
                tone={isCurrent ? 'default' : 'faint'}
                className="whitespace-nowrap"
              >
                {label}
              </Text>
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
