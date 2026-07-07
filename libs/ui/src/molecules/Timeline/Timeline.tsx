import { Icon } from '../../foundations/Icon';
import { Text } from '../../atoms/Text';

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
            <Text as="div" size="label" weight="regular" tone="default">
              <strong className="font-semibold">{entry.actor}</strong>{' '}
              <span className="text-cl-text-2">{entry.action}</span>
            </Text>
            {entry.diffFrom || entry.diffTo ? (
              <div className="mt-1 flex items-center gap-1.5">
                <Text as="span" size="mono" tone="faint" className="line-through">
                  {entry.diffFrom}
                </Text>
                <Icon name="arrow-right" size={12} className="text-cl-text-3" />
                <Text as="span" size="mono" className={DIFF_TO_CLASSES[tone]}>
                  {entry.diffTo}
                </Text>
              </div>
            ) : null}
            <Text as="div" size="mono" tone="faint" className="mt-0.5">
              {entry.time}
            </Text>
          </div>
        );
      })}
    </div>
  );
}
