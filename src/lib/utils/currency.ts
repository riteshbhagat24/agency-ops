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
 * Tax label varies by country. India = GST. UAE = VAT. UK = VAT. US = Sales Tax.
 */
export function taxLabel(country: string): string {
  switch (country) {
    case 'IN':
      return 'GST';
    case 'AE':
    case 'GB':
    case 'SG':
    case 'AU':
      return 'VAT';
    case 'US':
      return 'Sales Tax';
    default:
      return 'Tax';
  }
}
