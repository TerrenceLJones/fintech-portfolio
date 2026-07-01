export type ProgressTone = 'accent' | 'positive' | 'warning' | 'negative' | 'critical';

const TONE_CLASSES: Record<ProgressTone, string> = {
  accent: 'bg-cl-accent',
  positive: 'bg-cl-pos',
  warning: 'bg-cl-warn',
  negative: 'bg-cl-neg',
  critical: 'bg-cl-crit',
};

export interface ProgressBarProps {
  value: number;
  max?: number;
  tone?: ProgressTone;
  height?: number;
}

export function ProgressBar({ value, max = 100, tone = 'accent', height = 9 }: ProgressBarProps) {
  const pct = Math.max(0, Math.min(100, (value / (max || 1)) * 100));

  return (
    <div
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
      className="bg-cl-surface-2 w-full overflow-hidden rounded-full"
      style={{ height }}
    >
      <div
        className={`h-full rounded-full transition-[width] duration-300 ease-out ${TONE_CLASSES[tone]}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
