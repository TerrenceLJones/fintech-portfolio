import { Icon } from '@fintech-portfolio/icons';

export type TimelineTone = 'positive' | 'accent' | 'neutral' | 'warning' | 'negative';

export interface TimelineEntry {
  actor: string;
  action: string;
  tone?: TimelineTone;
  time: string;
  diffFrom?: string;
  diffTo?: string;
}

const DOT_CLASSES: Record<TimelineTone, string> = {
  positive: 'bg-cl-pos',
  accent: 'bg-cl-accent',
  neutral: 'bg-cl-text-3',
  warning: 'bg-cl-warn',
  negative: 'bg-cl-neg',
};

const DIFF_TO_CLASSES: Record<TimelineTone, string> = {
  positive: 'text-cl-pos',
  accent: 'text-cl-accent-text',
  neutral: 'text-cl-text-2',
  warning: 'text-cl-warn',
  negative: 'text-cl-neg',
};

export interface TimelineProps {
  entries: TimelineEntry[];
}

/** Append-only audit trail — actor/action/time with an optional before→after diff. */
export function Timeline({ entries }: TimelineProps) {
  return (
    <div className="border-cl-border relative border-l-[1.5px] pl-5.5 font-sans">
      {entries.map((entry, i) => {
        const tone = entry.tone ?? 'neutral';
        return (
          <div key={i} className={i === entries.length - 1 ? 'relative' : 'relative mb-4'}>
            <div
              className={`border-cl-surface absolute top-0.5 -left-[26px] h-2.75 w-2.75 rounded-full border-2 ${DOT_CLASSES[tone]}`}
            />
            <div className="text-cl-text text-[12.5px]">
              <strong className="font-semibold">{entry.actor}</strong>{' '}
              <span className="text-cl-text-2">{entry.action}</span>
            </div>
            {entry.diffFrom || entry.diffTo ? (
              <div className="font-mono mt-1 flex items-center gap-1.5 text-[11px]">
                <span className="text-cl-text-3 line-through">{entry.diffFrom}</span>
                <Icon name="arrow-right" size={12} className="text-cl-text-3" />
                <span className={DIFF_TO_CLASSES[tone]}>{entry.diffTo}</span>
              </div>
            ) : null}
            <div className="text-cl-text-3 font-mono mt-0.5 text-[11px]">{entry.time}</div>
          </div>
        );
      })}
    </div>
  );
}
