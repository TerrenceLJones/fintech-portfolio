import { Icon, type IconName } from '@fintech-portfolio/icons';
import { Button } from '../../atoms/Button';
import { Text } from '../../atoms/Text';

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
      <Text as="h3" size="heading" tone="default" className="mb-2">
        {title}
      </Text>
      <Text as="p" size="label" weight="regular" tone="muted" className="mb-0 max-w-[340px]">
        {body}
      </Text>
      {action ? (
        <Button variant="primary" onClick={onAction} className="mt-4.5">
          {action}
        </Button>
      ) : null}
    </div>
  );
}
