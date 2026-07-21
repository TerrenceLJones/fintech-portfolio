import { Text } from '../../atoms/Text';
import { Icon } from '../../foundations/Icon';

/** The three columns of the approval-tier table, shared by the header and every row (design §19.7). */
export const POLICY_RULE_GRID = 'grid grid-cols-[1.4fr_1.4fr_0.9fr] items-center gap-3';

export interface PolicyRuleRowProps {
  /** The formatted, inclusive amount range, e.g. "$0 – $10,000" or "$10,000+". */
  rangeLabel: string;
  /** The required approver, e.g. "Finance Manager", "Controller", or "Auto-approve". */
  approverLabel: string;
  /** When true, the approver cell renders the positive-toned auto-approve treatment (a check + label). */
  autoApprove?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  /** When false the delete action is hidden — e.g. the sole remaining tier can't be removed. */
  deletable?: boolean;
}

/**
 * One display row of the approval-policy tier table (design §19.7 / US-CW-037). Shows an amount range,
 * the required approver level, and edit/delete actions. Auto-approve is conveyed by a check icon AND the
 * "Auto-approve" text — never colour alone (design §19 doctrine). Purely presentational: the page owns
 * the tier state and swaps this row for an inline editor while a tier is being edited.
 */
export function PolicyRuleRow({
  rangeLabel,
  approverLabel,
  autoApprove = false,
  onEdit,
  onDelete,
  deletable = true,
}: PolicyRuleRowProps) {
  return (
    <div className={`${POLICY_RULE_GRID} border-cl-border border-b px-4 py-3 last:border-b-0`}>
      <Text as="span" className="font-mono text-[12.5px]">
        {rangeLabel}
      </Text>

      {autoApprove ? (
        <span className="text-cl-pos inline-flex items-center gap-1.5 text-[12.5px] font-medium">
          <Icon name="check" size={13} />
          {approverLabel}
        </span>
      ) : (
        <Text as="span" className="text-[12.5px]">
          {approverLabel}
        </Text>
      )}

      <div className="text-cl-text-3 flex items-center justify-end gap-3">
        {onEdit && (
          <button
            type="button"
            onClick={onEdit}
            aria-label={`Edit tier ${rangeLabel}`}
            className="hover:text-cl-text cursor-pointer"
          >
            <Icon name="pencil" size={15} />
          </button>
        )}
        {onDelete && deletable && (
          <button
            type="button"
            onClick={onDelete}
            aria-label={`Delete tier ${rangeLabel}`}
            className="hover:text-cl-neg cursor-pointer"
          >
            <Icon name="x-circle" size={15} />
          </button>
        )}
      </div>
    </div>
  );
}
