/** Public bootstrap is an explicit projection, never the settings database. */
const PUBLIC_SETTING_KEYS = new Set([
  'store_name', 'store_tagline', 'support_phone', 'store_address', 'hero_image',
  'currency', 'api_version', 'storefront_filters', 'payment_methods',
]);

export function publicSettings(all: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(all).filter(([key]) => PUBLIC_SETTING_KEYS.has(key)));
}
