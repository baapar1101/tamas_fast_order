/** Legacy sheet imports sometimes stored JSON columns as text. Normalize at
 * the response boundary so a malformed row cannot break a complete page. */
export function jsonArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string' || !value.trim()) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function productGallery(value: unknown): string[] {
  const entries = typeof value === 'string' && !value.trim().startsWith('[')
    ? value.trim().split(/\s+/)
    : jsonArray(value);
  return [...new Set(entries.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0))];
}

export function productAttributes(value: unknown): Array<{ key: string; value: string }> {
  return jsonArray(value).flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return [];
    const item = entry as Record<string, unknown>;
    return typeof item.key === 'string' && typeof item.value === 'string'
      ? [{ key: item.key, value: item.value }]
      : [];
  });
}
