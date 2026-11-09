/**
 * Catalog titles imported from spreadsheets often contain Arabic Yeh/Kaf
 * (ي / ك) instead of Persian ی / ک, which renders with the wrong glyphs and
 * looks broken next to correctly typed text. Normalise for display only.
 */
export function faText(value: string | null | undefined): string {
  if (!value) return '';
  return value.replace(/[يى]/g, 'ی').replace(/ك/g, 'ک');
}
