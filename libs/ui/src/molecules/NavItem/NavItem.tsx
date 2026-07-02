import { Icon, type IconName } from '@fintech-portfolio/icons';
import { Text } from '../../atoms/Text';

export interface NavItemProps {
  icon: IconName;
  label: string;
  active?: boolean;
  badge?: string;
  onClick?: () => void;
}

export function NavItem({ icon, label, active = false, badge, onClick }: NavItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={[
        'focus-visible:ring-cl-focus flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.75 py-2 text-left outline-none focus-visible:ring-3',
        active ? 'bg-cl-accent-weak' : '',
      ].join(' ')}
    >
      <Icon name={icon} size={16} />
      <Text
        as="span"
        size="label"
        weight={active ? 'semibold' : 'medium'}
        className={['flex-1 whitespace-nowrap', active ? 'text-cl-accent-text' : 'text-cl-text-2'].join(
          ' ',
        )}
      >
        {label}
      </Text>
      {badge ? (
        <Text
          as="span"
          size="mono"
          weight="semibold"
          className={[
            'rounded-full px-1.75 py-px',
            active ? 'bg-cl-accent text-white' : 'bg-cl-surface-2 text-cl-text-3',
          ].join(' ')}
        >
          {badge}
        </Text>
      ) : null}
    </button>
  );
}
