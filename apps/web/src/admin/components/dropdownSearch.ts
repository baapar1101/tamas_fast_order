export function shouldSearchDropdown(optionCount: number): boolean {
  return optionCount > 5;
}

export function normalizeDropdownSearch(value: string): string {
  return value.toLocaleLowerCase()
    .replace(/[يى]/g, 'ی').replace(/ك/g, 'ک')
    .replace(/[\u064b-\u065f\u200c\u200d\s]/g, '')
    .replace(/[٠-٩۰-۹]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit) >= 0
      ? '٠١٢٣٤٥٦٧٨٩'.indexOf(digit) : '۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
    .trim();
}
