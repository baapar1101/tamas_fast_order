/** Remove a terminal variant colour from a product title without changing its model name. */
const COLOR_ALIASES: ReadonlyArray<readonly [string, string]> = [
  ['زرد - مشکی', 'زرد - مشکی'],
  ['خاکستری تیره', 'خاکستری'],
  ['سفید طلایی', 'سفید طلایی'],
  ['بدون رنگ', 'شفاف'],
  ['بی رنگ', 'شفاف'],
  ['نقره ای', 'نقره ای'],
  ['سورمه ای', 'سورمه ای'],
  ['سرمه ای', 'سورمه ای'],
  ['قهوه ای', 'قهوه ای'],
  ['تیتانیوم', 'تیتانیوم'],
  ['خاکستری', 'خاکستری'],
  ['نارنجی', 'نارنجی'],
  ['لیمویی', 'لیمویی'],
  ['زیتونی', 'زیتونی'],
  ['شفاف', 'شفاف'],
  ['طلایی', 'طلایی'],
  ['صورتی', 'صورتی'],
  ['بنفش', 'بنفش'],
  ['مشکی', 'مشکی'],
  ['سفید', 'سفید'],
  ['طوسی', 'خاکستری'],
  ['کرمی', 'کرمی'],
  ['رنگی', 'رنگی'],
  ['یاسی', 'یاسی'],
  ['آبی', 'آبی'],
  ['سبز', 'سبز'],
  ['زرد', 'زرد'],
];

function fold(value: string): string {
  // Every replacement keeps the same UTF-16 length, so match offsets can be
  // applied to the original title without altering its other characters.
  return value.replace(/[يى]/g, 'ی').replace(/ك/g, 'ک').replace(/آ/g, 'ا').replace(/\u200c/g, ' ').toLowerCase();
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function canonicalColor(value: string): string {
  const normalized = fold(value.trim()).replace(/\s+/g, ' ');
  return COLOR_ALIASES.find(([alias]) => fold(alias) === normalized)?.[1] ?? normalized;
}

function removeColorPrefix(value: string): string {
  return value
    .replace(/[\s\u200c]*رنگ[\s\u200c]*$/u, '')
    .replace(/[\s\u200c.,،\-–—]+$/u, '')
    .trim();
}

export interface ProductTitleColorCleanup {
  title: string;
  color: string | null;
  detectedColor: string | null;
  colorConflict: boolean;
  changed: boolean;
}

export function cleanProductTitleColor(title: string, currentColor: string | null): ProductTitleColorCleanup {
  const existingColor = currentColor?.trim() || null;
  const folded = fold(title);
  let nextTitle = title;
  let detectedColor: string | null = null;

  for (const [alias, color] of COLOR_ALIASES) {
    const aliasPattern = fold(alias).split(/\s+/).map(escapeRegex).join('[\\s\\u200c]*');
    const match = new RegExp(`${aliasPattern}[\\s\\u200c]*$`, 'u').exec(folded);
    if (!match) continue;
    const candidate = removeColorPrefix(title.slice(0, match.index));
    if (!candidate) break;
    nextTitle = candidate;
    detectedColor = color;
    break;
  }

  // "مات" is a finish, not a colour; keep it in the title.
  if (!detectedColor) {
    const matteMatch = /مشکی[\s\u200c]+مات[\s\u200c]*$/u.exec(folded);
    if (matteMatch) {
      const candidate = removeColorPrefix(title.slice(0, matteMatch.index));
      if (candidate) {
        nextTitle = `${candidate} مات`;
        detectedColor = 'مشکی';
      }
    }
  }

  const color = existingColor ?? detectedColor;
  return {
    title: nextTitle,
    color,
    detectedColor,
    colorConflict: Boolean(existingColor && detectedColor && canonicalColor(existingColor) !== detectedColor),
    changed: nextTitle !== title || color !== existingColor,
  };
}
