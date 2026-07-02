import { Icon, type IconName } from '@fintech-portfolio/icons';
import { Button } from '../../atoms/Button';

export interface EmptyStateProps {
  icon: IconName;
  title: string;
  body: string;
  action?: string;
  onAction?: () => void;
}

export function EmptyState({ icon, title, body, action, onAction }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center font-sans">
      <div className="bg-cl-surface-2 mb-4 flex h-11.5 w-11.5 items-center justify-center rounded-xl">
        <Icon name={icon} size={22} className="text-cl-text-3" />
      </div>
      <h3 className="text-cl-text mb-2 text-base font-semibold">{title}</h3>
      <p className="text-cl-text-2 mb-0 max-w-[340px] text-xs leading-relaxed">{body}</p>
      {action ? (
        <Button variant="primary" onClick={onAction} className="mt-4.5">
          {action}
        </Button>
      ) : null}
    </div>
  );
}
