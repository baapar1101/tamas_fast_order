/**
 * On tablet and phone widths the storefront CSS gives `html, body` a fixed
 * height with `overflow-x: hidden`, which turns <body> into the scroll
 * container. `window.scrollTo` is then a no-op, so reset every candidate.
 */
export function scrollPageToTop(behavior: ScrollBehavior = 'auto'): void {
  if (typeof window === 'undefined') return;
  window.scrollTo({ top: 0, behavior });
  document.body?.scrollTo?.({ top: 0, behavior });
  document.documentElement?.scrollTo?.({ top: 0, behavior });
}

/** Brings an element into view inside whichever ancestor actually scrolls. */
export function scrollIntoViewSoft(element: Element | null | undefined, block: ScrollLogicalPosition = 'start'): void {
  element?.scrollIntoView({ behavior: 'smooth', block });
}
