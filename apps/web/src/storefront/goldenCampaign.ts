import type { StorefrontSlide } from './hooks';

export const GOLDEN_CAMPAIGN_IMAGE_URL = '/assets/slides/golden-days-2026-10.webp';
export const GOLDEN_CAMPAIGN_LIGHT_IMAGE_URL = '/assets/slides/golden-days-2026-10-light.webp';
// Midnight at the start of 21 Mehr 1405 in Tehran (UTC+03:30).
export const GOLDEN_CAMPAIGN_END_AT = Date.parse('2026-10-12T20:30:00.000Z');

export function isGoldenCampaignSlide(slide: Pick<StorefrontSlide, 'imageUrl'>): boolean {
  return slide.imageUrl === GOLDEN_CAMPAIGN_IMAGE_URL;
}

export function visibleCampaignSlides<T extends Pick<StorefrontSlide, 'imageUrl'>>(
  slides: T[],
  now = Date.now(),
): T[] {
  return now >= GOLDEN_CAMPAIGN_END_AT
    ? slides.filter((slide) => !isGoldenCampaignSlide(slide))
    : slides;
}
