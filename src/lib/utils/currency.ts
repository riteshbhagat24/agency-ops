const CURRENCY_LOCALE: Record<string, string> = {
  INR: 'en-IN',
  USD: 'en-US',
  AED: 'en-AE',
  GBP: 'en-GB',
  SGD: 'en-SG',
  AUD: 'en-AU',
};

export function formatMoney(
  amount: number | null | undefined,
  currency: string = 'INR',
  options: { compact?: boolean } = {},
) {
  if (amount == null) return '—';
  const locale = CURRENCY_LOCALE[currency] ?? 'en-IN';
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    notation: options.compact ? 'compact' : 'standard',
    maximumFractionDigits: options.compact ? 1 : 2,
  }).format(amount);
}

/**
 * Always "GST" — the agency uses the GST label universally.
 * GST is only applicable for India clients; for non-India clients the
 * tax_rate is 0 and the field is disabled in the UI.
 */
export function taxLabel(_country: string): string {
  return 'GST';
}
