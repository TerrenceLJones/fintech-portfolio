import { Alert, Button } from '@clearline/ui';

export interface FreezeControlProps {
  frozen: boolean;
  onToggle: () => void;
  isBusy: boolean;
}

/**
 * The freeze / unfreeze control (US-CW-014 AC-05). Freezing stops the card authorizing immediately at
 * the server; a frozen card shows an info banner explaining that new transactions are blocked while
 * existing authorizations still settle. Only rendered for a Controller (cards:manage).
 */
export function FreezeControl({ frozen, onToggle, isBusy }: FreezeControlProps) {
  return (
    <div className="flex flex-col gap-3">
      {frozen ? (
        <Alert
          tone="neutral"
          icon="snowflake"
          title="Card frozen"
          message="New transactions are blocked. Existing authorizations still settle."
        />
      ) : null}
      <Button
        variant={frozen ? 'primary' : 'secondary'}
        icon="snowflake"
        fullWidth
        onClick={onToggle}
        loading={isBusy}
      >
        {frozen ? 'Unfreeze card' : 'Freeze card'}
      </Button>
    </div>
  );
}
