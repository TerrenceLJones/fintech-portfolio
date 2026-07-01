import { Icon, type IconName } from '@fintech-portfolio/icons';

export interface NavItemProps {
  icon: IconName;
  label: string;
  active?: boolean;
  badge?: string;
}

export function NavItem({ icon, label, active = false, badge }: NavItemProps) {
  return (
    <div
      className={[
        'flex cursor-pointer items-center gap-2.5 rounded-lg px-2.75 py-2 font-sans text-[13px]',
        active
          ? 'bg-cl-accent-weak text-cl-accent-text font-semibold'
          : 'text-cl-text-2 font-medium',
      ].join(' ')}
    >
      <Icon name={icon} size={16} />
      <span className="flex-1 whitespace-nowrap">{label}</span>
      {badge ? (
        <span
          className={[
            'font-mono rounded-full px-1.75 py-px text-[10.5px] font-semibold',
            active ? 'bg-cl-accent text-white' : 'bg-cl-surface-2 text-cl-text-3',
          ].join(' ')}
        >
          {badge}
        </span>
      ) : null}
    </div>
  );
}
