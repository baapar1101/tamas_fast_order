const SOURCE_BRAND_PATTERN = /(?:دیجی[\s\u200c-]*کالا|digikala)/gi;
const EXTERNAL_URL_PATTERN = /https?:\/\/[^\s<>"']+/gi;

/**
 * Content imported from external catalogues is presented as Tamas Market
 * editorial copy. Outbound URLs are removed and source-brand mentions are
 * consistently replaced, including spaced and half-space Persian spellings.
 */
export function sanitizeExternalText(value: string | null | undefined): string {
  return String(value ?? '')
    .replace(EXTERNAL_URL_PATTERN, '')
    .replace(SOURCE_BRAND_PATTERN, 'تماس مارکت')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
