import { describe, expect, it } from 'vitest';
import { formatMoney } from './formatMoney';

describe('formatMoney', () => {
  it('formats a USD amount by default', () => {
    expect(formatMoney(48210)).toBe('$48,210.00');
  });

  it('drops the sign — callers indicate credit/debit separately', () => {
    expect(formatMoney(-5000)).toBe('$5,000.00');
  });

  it('formats a 0-decimal currency without cents', () => {
    expect(formatMoney(182050, 'JPY')).toBe('¥182,050');
  });

  it('formats a 3-decimal currency with 3 decimal places', () => {
    expect(formatMoney(182.05, 'BHD')).toBe('BHD 182.050');
  });
});
