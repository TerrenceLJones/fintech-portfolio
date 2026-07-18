import type { Money } from '@clearline/contracts';
import { minorUnitExponent } from './minor-unit-exponent';
import { toMajorUnits } from './to-major-units';

/**
 * Spoken names for a currency's major and minor units. Screen readers should hear "dollars"/"cents",
 * not the ISO code or the bare symbol. Keyed by ISO 4217; unknown codes fall back to a generic
 * "units"/"subunits" so the label is still a full spoken phrase rather than an unreadable symbol.
 */
const UNIT_NAMES: Record<string, { major: [string, string]; minor: [string, string] }> = {
  USD: { major: ['dollar', 'dollars'], minor: ['cent', 'cents'] },
  EUR: { major: ['euro', 'euros'], minor: ['cent', 'cents'] },
  GBP: { major: ['pound', 'pounds'], minor: ['penny', 'pence'] },
  JPY: { major: ['yen', 'yen'], minor: ['sen', 'sen'] },
  CAD: { major: ['dollar', 'dollars'], minor: ['cent', 'cents'] },
  AUD: { major: ['dollar', 'dollars'], minor: ['cent', 'cents'] },
};

const ONES = [
  'zero',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
  'thirteen',
  'fourteen',
  'fifteen',
  'sixteen',
  'seventeen',
  'eighteen',
  'nineteen',
];

const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

// Scale words indexed by group-of-three position (0 = units, 1 = thousand, ...).
const SCALES = ['', 'thousand', 'million', 'billion', 'trillion'];

/** Speaks an integer 0–999 (no leading scale word) — the building block for each three-digit group. */
function speakUnder1000(n: number): string {
  if (n < 20) return ONES[n] ?? '';
  if (n < 100) {
    const tens = TENS[Math.floor(n / 10)] ?? '';
    const ones = n % 10;
    return ones === 0 ? tens : `${tens}-${ONES[ones] ?? ''}`;
  }
  const hundreds = `${ONES[Math.floor(n / 100)] ?? ''} hundred`;
  const rest = n % 100;
  return rest === 0 ? hundreds : `${hundreds} ${speakUnder1000(rest)}`;
}

/**
 * Speaks a non-negative integer in words: 1234567 -> "one million two hundred thirty-four thousand
 * five hundred sixty-seven". Handles up to the trillions; beyond that it reads the leading group with
 * its scale, which is more than any spend amount needs.
 */
function speakInteger(value: number): string {
  if (value === 0) return 'zero';

  const groups: number[] = [];
  let remaining = value;
  while (remaining > 0) {
    groups.push(remaining % 1000);
    remaining = Math.floor(remaining / 1000);
  }

  const parts: string[] = [];
  for (let i = groups.length - 1; i >= 0; i--) {
    const group = groups[i];
    if (!group) continue;
    const scale = SCALES[i] ?? '';
    parts.push(scale ? `${speakUnder1000(group)} ${scale}` : speakUnder1000(group));
  }
  return parts.join(' ');
}

/** Uppercases the first letter of the assembled phrase — screen readers ignore case, but it keeps
 * debug output and any visible fallback reading as a sentence. */
function capitalize(phrase: string): string {
  return phrase.charAt(0).toUpperCase() + phrase.slice(1);
}

/**
 * Spells a major-unit amount (e.g. dollars, not cents) as a fully spoken phrase for a screen-reader
 * `aria-label` — "$1,999.00" becomes "One thousand nine hundred ninety-nine dollars". Mirrors
 * `formatMoney`'s `(amount, currency)` signature so a component can format for sight and speech from
 * the same inputs. The minor unit is read only when non-zero and only for currencies that have one
 * (JPY has none), and the amount is rounded to the currency's own precision so a float like `10.005`
 * reads as "one cent", never spurious sub-cent precision.
 */
export function spokenMoneyAmount(amount: number, currency: string = 'USD'): string {
  const names = UNIT_NAMES[currency] ?? {
    major: ['unit', 'units'],
    minor: ['subunit', 'subunits'],
  };
  const exponent = minorUnitExponent(currency);
  const scale = 10 ** exponent;

  const negative = amount < 0;
  // Round in minor units so we never read precision the currency doesn't have.
  const totalMinor = Math.round(Math.abs(amount) * scale);
  const majorValue = Math.floor(totalMinor / scale);
  const minorValue = totalMinor - majorValue * scale;

  const majorWord = majorValue === 1 ? names.major[0] : names.major[1];
  let phrase = `${speakInteger(majorValue)} ${majorWord}`;

  if (exponent > 0 && minorValue > 0) {
    const minorWord = minorValue === 1 ? names.minor[0] : names.minor[1];
    phrase += ` and ${speakInteger(minorValue)} ${minorWord}`;
  }

  if (negative) phrase = `negative ${phrase}`;
  return capitalize(phrase);
}

/**
 * Spells a `Money` value (raw minor units + its currency) as a spoken phrase — the one-step form of
 * `spokenMoneyAmount(toMajorUnits(money), money.currency)`, mirroring `formatMoneyValue`.
 */
export function spokenMoney(money: Money): string {
  return spokenMoneyAmount(toMajorUnits(money), money.currency);
}
