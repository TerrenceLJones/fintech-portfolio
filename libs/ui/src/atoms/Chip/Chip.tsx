import { Icon, type IconName } from '@fintech-portfolio/icons';

export interface ChipProps {
  label: string;
  selected?: boolean;
  removable?: boolean;
  onRemove?: () => void;
  icon?: IconName;
}

export function Chip({ label, selected = false, removable = false, onRemove, icon }: ChipProps) {
  return (
    <span
      className={[
        'inline-flex items-center gap-1.5 rounded-md px-2.75 py-1.5 text-xs leading-none font-medium whitespace-nowrap',
        selected
          ? 'bg-cl-accent text-white'
          : 'bg-cl-surface text-cl-text-2 border-cl-border-2 border',
      ].join(' ')}
    >
      {selected ? <Icon name="check" size={11} /> : icon ? <Icon name={icon} size={11} /> : null}
      <span>{label}</span>
      {removable ? (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${label}`}
          className="ml-0.5 inline-flex cursor-pointer opacity-70"
        >
          <Icon name="x" size={11} />
        </button>
      ) : null}
    </span>
  );
}
