export const CURRENCY_PREFIX = 'Rs ';

export function formatMoney(amount: number) {
  return `${CURRENCY_PREFIX}${amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}
