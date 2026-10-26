// Management is the only embedded web surface. Customer routes stay native.
export const MANAGEMENT_ORIGIN = "https://tamasmarket.com";
export function managementNavigation(
  value: string,
): "internal" | "external" | "block" {
  try {
    const url = new URL(value);
    if (url.username || url.password) return "block";
    if (url.origin === MANAGEMENT_ORIGIN && url.protocol === "https:")
      return "internal";
    return ["https:", "tel:", "mailto:"].includes(url.protocol)
      ? "external"
      : "block";
  } catch {
    return "block";
  }
}
