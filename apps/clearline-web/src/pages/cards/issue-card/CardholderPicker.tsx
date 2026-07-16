import type { CardholderCandidate } from '@clearline/contracts';
import { Avatar, Text } from '@clearline/ui';

export interface CardholderPickerProps {
  candidates: CardholderCandidate[];
  selectedId: string;
  onSelect: (id: string) => void;
}

/** Pick the employee a card is issued to — each candidate is a selectable avatar + name row (AC-01). */
export function CardholderPicker({ candidates, selectedId, onSelect }: CardholderPickerProps) {
  return (
    <div className="flex flex-col gap-2">
      {candidates.map((candidate) => {
        const selected = candidate.id === selectedId;
        return (
          <button
            key={candidate.id}
            type="button"
            aria-pressed={selected}
            onClick={() => onSelect(candidate.id)}
            className={[
              'focus-visible:outline-cl-focus flex items-center gap-3 rounded-lg border px-3 py-2.25 text-left focus-visible:outline-2',
              selected
                ? 'border-cl-accent bg-cl-accent-weak'
                : 'border-cl-border-2 bg-cl-surface hover:border-cl-border',
            ].join(' ')}
          >
            <Avatar initials={candidate.initials} size={32} />
            <div>
              <Text as="div" size="label" weight="semibold" tone="default">
                {candidate.name} — {candidate.team}
              </Text>
            </div>
          </button>
        );
      })}
    </div>
  );
}
