import type { FunnelStepDTO } from '@tamas/shared';

/** Narrowest band, as a share of the funnel's width, so the count always fits. */
export const FUNNEL_MIN_WIDTH = 26;

/**
 * Band widths follow the share of people still in the funnel (square-root
 * scaled so late, small stages stay readable) and never widen again.
 */
export function funnelWidths(steps: Pick<FunnelStepDTO, 'people'>[]): number[] {
  const top = steps[0]?.people ?? 0;
  let previous = 100;
  return steps.map((step) => {
    const share = top > 0 ? Math.min(1, step.people / top) : 0;
    const width = Math.min(previous, FUNNEL_MIN_WIDTH + (100 - FUNNEL_MIN_WIDTH) * Math.sqrt(share));
    previous = width;
    return width;
  });
}
