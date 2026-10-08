/** Title-case Latin words in product names while keeping model codes and units readable. */
const ACRONYMS = new Set([
  'AC', 'AMOLED', 'AUX', 'CPU', 'DC', 'EU', 'FHD', 'GB', 'GPS', 'GPU',
  'HD', 'HDMI', 'IP', 'LCD', 'LED', 'MB', 'NFC', 'OLED', 'OTG', 'PD',
  'QC', 'RAM', 'RGB', 'ROM', 'SD', 'SIM', 'TB', 'UHD', 'UK', 'US', 'USB', 'UV',
]);

const UNITS = new Map([
  ['CM', 'cm'], ['GHZ', 'GHz'], ['HZ', 'Hz'], ['KG', 'kg'],
  ['MAH', 'mAh'], ['MHZ', 'MHz'], ['MM', 'mm'], ['W', 'W'], ['WH', 'Wh'],
]);

export function formatProductTitle(title: string): string {
  return title.replace(/(?<![A-Za-z0-9])[A-Za-z][A-Za-z0-9]*/g, (word) => {
    // C81, S26 and similar model codes retain their number/letter structure.
    if (/\d/.test(word)) return word[0]!.toUpperCase() + word.slice(1);
    const upper = word.toUpperCase();
    if (ACRONYMS.has(upper)) return upper;
    const unit = UNITS.get(upper);
    if (unit) return unit;
    // Preserve intentional branding such as iPhone and MicroUSB.
    if (/[a-z]/.test(word) && /[A-Z]/.test(word) && !/^[A-Z][a-z]*$/.test(word)) return word;
    return word[0]!.toUpperCase() + word.slice(1).toLowerCase();
  });
}
