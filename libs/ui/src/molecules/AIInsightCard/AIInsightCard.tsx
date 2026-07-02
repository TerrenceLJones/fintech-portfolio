import { Icon } from '@fintech-portfolio/icons';
import { Button } from '../../atoms/Button';

export type InsightTone = 'info' | 'anomaly';

export interface AIInsightCardProps {
  title: string;
  body: string;
  confidence?: number;
  tone?: InsightTone;
  actionPrimary?: string;
  actionSecondary?: string;
  onActionPrimary?: () => void;
  onActionSecondary?: () => void;
}

export function AIInsightCard({
  title,
  body,
  confidence = 87,
  tone = 'info',
  actionPrimary,
  actionSecondary,
  onActionPrimary,
  onActionSecondary,
}: AIInsightCardProps) {
  const anomaly = tone === 'anomaly';
  const fgClass = anomaly ? 'text-cl-warn' : 'text-cl-accent-text';
  const fillClass = anomaly ? 'bg-cl-warn' : 'bg-cl-accent';
  const buttonTone = anomaly ? 'warning' : 'accent';

  return (
    <div
      className={[
        'rounded-xl border p-4 font-sans',
        anomaly ? 'bg-cl-warn-weak border-cl-warn/26' : 'bg-cl-surface border-cl-border',
      ].join(' ')}
    >
      <div className="mb-2.5 flex items-center gap-2">
        <Icon name="sparkles" size={16} className={fgClass} />
        <span className="text-cl-text flex-1 text-[13.5px] font-semibold">{title}</span>
        <span
          className={`font-mono rounded border px-1.5 py-px text-[9.5px] font-semibold tracking-wide ${fgClass} border-current`}
        >
          AI
        </span>
      </div>
      <div className="text-cl-text-2 mb-3 text-xs leading-relaxed">{body}</div>
      <div className="mb-3.5 flex items-center justify-between text-[11px]">
        <span className="text-cl-text-2">AI confidence</span>
        <span className={`font-mono font-semibold ${fgClass}`}>{confidence}%</span>
      </div>
      <div className="bg-cl-surface-2 mb-3.5 h-1.5 overflow-hidden rounded-full">
        <div className={`h-full rounded-full ${fillClass}`} style={{ width: `${confidence}%` }} />
      </div>
      {actionPrimary ? (
        <div className="flex gap-2.25">
          {actionSecondary ? (
            <Button variant="secondary" size="sm" onClick={onActionSecondary} className="flex-1">
              {actionSecondary}
            </Button>
          ) : null}
          <Button
            variant="primary"
            tone={buttonTone}
            size="sm"
            onClick={onActionPrimary}
            className="flex-1"
          >
            {actionPrimary}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
