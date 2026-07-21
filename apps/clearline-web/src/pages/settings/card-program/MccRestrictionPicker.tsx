import { useState } from 'react';
import type { MerchantCategoryOption } from '@clearline/contracts';
import { searchMerchantCategories } from '@clearline/domain-cards';
import { Icon, Text, TextField } from '@clearline/ui';

export interface MccRestrictionPickerProps {
  catalogue: MerchantCategoryOption[];
  /** Selected MCC `code`s; an empty selection leaves new cards unrestricted. */
  selected: string[];
  onToggle: (code: string) => void;
}

/**
 * The searchable merchant-category restriction list for Card Program defaults (US-CW-038 AC-02). The
 * search box filters the catalogue by category name OR numeric MCC code (both resolve, via the pure
 * domain `searchMerchantCategories`). A selected category reads as a filled chip with a check; an
 * unselected one as a "+ Label" outline chip. An empty selection is stated in words, since "no chips"
 * could otherwise be misread as unset rather than unrestricted.
 */
export function MccRestrictionPicker({ catalogue, selected, onToggle }: MccRestrictionPickerProps) {
  const [query, setQuery] = useState('');
  const results = searchMerchantCategories(catalogue, query);

  return (
    <div className="flex flex-col gap-3">
      <div className="w-72 max-w-full">
        <TextField
          aria-label="Search merchant categories"
          placeholder="Search by name or MCC code…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>

      {results.length === 0 ? (
        <Text as="p" size="label" tone="faint">
          No category matches “{query}”.
        </Text>
      ) : (
        <div className="flex flex-wrap gap-2">
          {results.map((category) => {
            const isSelected = selected.includes(category.code);
            return (
              <button
                key={category.code}
                type="button"
                aria-pressed={isSelected}
                onClick={() => onToggle(category.code)}
                title={`MCC ${category.mcc}`}
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
      )}

      <Text as="p" size="label" tone="faint">
        {selected.length === 0
          ? 'No restrictions — new cards can transact in any merchant category.'
          : `New cards are restricted to ${selected.length} categor${selected.length === 1 ? 'y' : 'ies'}.`}
      </Text>
    </div>
  );
}
