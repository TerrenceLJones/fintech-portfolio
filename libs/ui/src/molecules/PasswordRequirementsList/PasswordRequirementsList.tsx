import { Icon } from '@fintech-portfolio/icons';

export interface PasswordRequirementItem {
  label: string;
  met: boolean;
}

export interface PasswordRequirementsListProps {
  items: PasswordRequirementItem[];
}

/**
 * Presentation-only live checklist for password-complexity requirements (sign-up AC-04) — takes
 * plain `{label, met}` pairs rather than importing `@fintech-portfolio/domain-auth` directly, so
 * the page computes requirement results with the real policy and this molecule just renders them,
 * the same domain/UI split every other page here already follows.
 */
export function PasswordRequirementsList({ items }: PasswordRequirementsListProps) {
  return (
    <div className="grid grid-cols-2 gap-x-3.5 gap-y-1.5">
      {items.map((item) => (
        <div
          key={item.label}
          data-requirement-met={item.met}
          className={`flex items-center gap-1.5 text-[11.5px] ${
            item.met ? 'text-cl-pos' : 'text-cl-text-3'
          }`}
        >
          <Icon name={item.met ? 'check' : 'x-circle'} size={13} className="shrink-0" />
          {item.label}
        </div>
      ))}
    </div>
  );
}
