import { Icon } from '@fintech-portfolio/icons';
import { formatMoney } from '../../utils/formatMoney';
import { Text } from '../../atoms/Text';

export type CardState = 'active' | 'frozen';

export interface VirtualCardProps {
  holder: string;
  last4: string;
  remaining?: number;
  exp: string;
  state?: CardState;
}

export function VirtualCard({ holder, last4, remaining, exp, state = 'active' }: VirtualCardProps) {
  const frozen = state === 'frozen';

  return (
    <div
      className={[
        'relative w-full overflow-hidden rounded-2xl p-5 font-sans',
        frozen
          ? 'bg-cl-surface-2 border-cl-border-2 text-cl-text-2 border'
          : 'bg-linear-to-br from-[#2f5ce0] via-[#3b6cf6] to-[#1d3a9e] text-white',
      ].join(' ')}
    >
      {frozen ? (
        <Text
          as="div"
          size="label"
          weight="semibold"
          className="bg-cl-text absolute top-4 right-4 inline-flex items-center gap-1.5 rounded-md px-2.25 py-0.75 text-white"
        >
          <Icon name="snowflake" size={11} />
          Frozen
        </Text>
      ) : null}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <Text
            as="div"
            size="label"
            weight="regular"
            className={frozen ? 'text-cl-text-3' : 'opacity-80'}
          >
            Clearline &middot; Virtual
          </Text>
          <Text as="div" size="body" weight="semibold" className="mt-0.5">
            {holder}
          </Text>
        </div>
        {frozen ? null : <Icon name="logo" size={20} color="rgba(255,255,255,0.9)" />}
      </div>
      <div
        className={`font-mono mb-3 text-[15px] tracking-[0.12em] ${frozen ? 'text-cl-text-3' : ''}`}
      >
        •••• •••• •••• {last4}
      </div>
      <div className="flex items-end justify-between">
        <Text as="div" size="mono" className={frozen ? 'text-cl-text-3' : 'opacity-85'}>
          EXP {exp}
        </Text>
        {frozen ? (
          <Text as="div" size="mono" tone="faint">
            Not authorizing
          </Text>
        ) : (
          <div className="text-right">
            <div className="inline-flex items-center gap-1 text-[10px] opacity-80">
              <Icon name="lock" size={9} color="rgba(255,255,255,0.85)" />
              Remaining &middot; derived
            </div>
            <div className="font-mono mt-0.5 text-[15px] font-semibold">
              {remaining != null ? formatMoney(remaining) : '—'}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
