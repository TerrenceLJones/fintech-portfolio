import type { MerchantCategory } from '@clearline/contracts';
import { Icon } from '@clearline/ui';

export interface MccChipSelectorProps {
  categories: MerchantCategory[];
  selected: string[];
  onToggle: (code: string) => void;
}

/**
 * Toggle the merchant categories a card may transact in (US-CW-014 AC-01). A selected category reads
 * as a filled chip with a check; an unselected one as a "+ Label" outline chip. An empty selection
 * leaves the card unrestricted.
 */
export function MccChipSelector({ categories, selected, onToggle }: MccChipSelectorProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {categories.map((category) => {
        const isSelected = selected.includes(category.code);
        return (
          <button
            key={category.code}
            type="button"
            aria-pressed={isSelected}
            onClick={() => onToggle(category.code)}
            className={[
              'focus-visible:outline-cl-focus inline-flex items-center gap-1.5 rounded-md px-2.75 py-1.5 text-[12.5px] font-medium focus-visible:outline-2',
              isSelected
                ? 'bg-cl-accent text-white'
                : 'border-cl-border-2 text-cl-text-2 bg-cl-surface border',
            ].join(' ')}
          >
            <Icon name={isSelected ? 'check' : 'plus'} size={12} />
            {category.label}
          </button>
        );
      })}
    </div>
  );
}
