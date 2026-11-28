import { useLayoutEffect, useRef } from 'react';

const EASE = 'cubic-bezier(.76,0,.24,1)';

function translateY(el: HTMLElement): number {
  const value = getComputedStyle(el).translate;
  return value === 'none' ? 0 : parseFloat(value.split(' ')[1] ?? '0') || 0;
}

/**
 * MARK's active-item marker for the sidebar: a soft highlight («glide») behind the
 * current page's item and a rail on the sidebar's outer edge. When the page changes
 * both slide to the new item, and the rail stretches with the distance it travels.
 * The items themselves stay transparent. Render it as the first child of the nav
 * menu; it positions itself against that menu.
 */
export function NavGlide({ current }: { current: string }) {
  const glideRef = useRef<HTMLSpanElement>(null);
  const railRef = useRef<HTMLSpanElement>(null);
  const lastRef = useRef<string | null>(null);

  useLayoutEffect(() => {
    // The menu is the glide's parent. (A ref on the parent is not attached yet
    // when this child's layout effect first runs.)
    const glide = glideRef.current;
    const nav = glide?.parentElement;
    const rail = railRef.current;
    if (!nav || !glide || !rail) return;

    const place = (animate: boolean) => {
      const item = [...nav.querySelectorAll<HTMLElement>('a.nav-item[aria-current="page"]')].find((el) => el.offsetHeight);
      if (!item) {
        glide.style.opacity = rail.style.opacity = '0';
        delete glide.dataset.at;
        lastRef.current = null;
        return;
      }
      const box = nav.getBoundingClientRect();
      const rect = item.getBoundingClientRect();
      const top = rect.top - box.top - nav.clientTop + nav.scrollTop;
      const left = rect.left - box.left - nav.clientLeft + nav.scrollLeft;
      const railHeight = Math.round(rect.height * 0.86);
      const railTop = top + (rect.height - railHeight) / 2;
      const key = `${left}:${top}:${rect.width}:${rect.height}`;
      if (!animate && glide.dataset.at === key) return;
      glide.dataset.at = key;

      const wasVisible = glide.style.opacity === '1';
      const [fromGlide, fromRail] = [translateY(glide), translateY(rail)];
      for (const el of [glide, rail]) for (const animation of el.getAnimations()) animation.cancel();
      Object.assign(glide.style, { left: `${left}px`, width: `${rect.width}px`, height: `${rect.height}px`, translate: `0 ${top}px`, opacity: '1' });
      Object.assign(rail.style, { height: `${railHeight}px`, translate: `0 ${railTop}px`, opacity: '1' });

      const distance = Math.abs(railTop - fromRail);
      if (!animate || !wasVisible || distance < 1 || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      glide.animate([{ translate: `0 ${fromGlide}px` }, { translate: `0 ${top}px` }], { duration: 600, easing: EASE });
      rail.animate([{ translate: `0 ${fromRail}px` }, { translate: `0 ${railTop}px` }], { duration: 600, easing: EASE });
      const stretch = 1 + 0.45 * Math.min(distance / 40, 4);
      rail.animate([{ scale: '1 1' }, { scale: `1 ${stretch}` }, { scale: '1 1' }], { duration: 600, easing: 'cubic-bezier(.65,0,.35,1)' });
    };

    place(lastRef.current !== null && lastRef.current !== current);
    lastRef.current = current;

    // Accordions open and close: follow the item while the layout settles.
    const resize = new ResizeObserver(() => place(false));
    resize.observe(nav);
    for (const child of nav.children) if (child !== glide && child !== rail) resize.observe(child);
    const onEnd = () => place(false);
    nav.addEventListener('transitionend', onEnd);
    return () => {
      resize.disconnect();
      nav.removeEventListener('transitionend', onEnd);
    };
  }, [current]);

  return (
    <>
      <span ref={glideRef} className="nav-glide" aria-hidden="true" />
      <span ref={railRef} className="nav-rail" aria-hidden="true" />
    </>
  );
}
