import { useEffect, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { cn } from '../../components/ui/cn';

/** Fades and lifts its content in once, when it scrolls into view. */
export function Reveal({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}

/** Cycles through words in place, with a short blur-and-slide swap. */
export function FlipWords({ words, className, interval = 2800 }: { words: string[]; className?: string; interval?: number }) {
  const reduce = useReducedMotion();
  const [index, setIndex] = useState(0);
  useEffect(() => {
    setIndex(0);
    if (words.length < 2) return undefined;
    const timer = window.setInterval(() => setIndex((current) => (current + 1) % words.length), interval);
    return () => window.clearInterval(timer);
  }, [words, interval]);
  const word = words[index] ?? '';
  if (!word) return null;
  if (reduce) return <span className={className}>{word}</span>;
  // The longest word holds the line's width, so the heading never jumps while words swap.
  const longest = words.reduce((a, b) => (b.length > a.length ? b : a), '');
  return (
    <span className="inline-grid">
      <span className={cn('invisible col-start-1 row-start-1', className)} aria-hidden="true">{longest}</span>
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={word}
          className={cn('col-start-1 row-start-1 inline-block text-center md:text-start', className)}
          initial={{ opacity: 0, y: 14, filter: 'blur(8px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          exit={{ opacity: 0, y: -14, filter: 'blur(8px)' }}
          transition={{ duration: 0.38, ease: 'easeOut' }}
        >
          {word}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

const finePointer = () => typeof window !== 'undefined' && window.matchMedia('(hover: hover) and (pointer: fine)').matches;

/** A card whose border lights up on the side nearest the pointer. */
export function GlowCard({ children, className, style }: { children: ReactNode; className?: string; style?: CSSProperties }) {
  const ref = useRef<HTMLDivElement>(null);
  const onMove = (event: PointerEvent<HTMLDivElement>) => {
    const element = ref.current;
    if (!element || event.pointerType !== 'mouse') return;
    const rect = element.getBoundingClientRect();
    const angle = (Math.atan2(event.clientY - (rect.top + rect.height / 2), event.clientX - (rect.left + rect.width / 2)) * 180) / Math.PI + 90;
    element.style.setProperty('--glow-angle', `${angle}deg`);
    element.style.setProperty('--glow-on', '1');
  };
  return (
    <div ref={ref} className={cn('lp-glow', className)} style={style} onPointerMove={onMove} onPointerLeave={() => ref.current?.style.setProperty('--glow-on', '0')}>
      {children}
    </div>
  );
}

/** A card lit from inside by a soft light that follows the pointer. */
export function SpotCard({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const onMove = (event: PointerEvent<HTMLDivElement>) => {
    const element = ref.current;
    if (!element) return;
    const rect = element.getBoundingClientRect();
    element.style.setProperty('--mx', `${event.clientX - rect.left}px`);
    element.style.setProperty('--my', `${event.clientY - rect.top}px`);
  };
  return <div ref={ref} className={cn('lp-spot', className)} onPointerMove={onMove}>{children}</div>;
}

/** Tilts its content slightly towards the pointer (desktop mouse only). */
export function TiltFrame({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const reset = () => {
    ref.current?.style.setProperty('--rx', '0deg');
    ref.current?.style.setProperty('--ry', '0deg');
  };
  const onMove = (event: PointerEvent<HTMLDivElement>) => {
    const element = ref.current;
    if (!element || !finePointer()) return;
    const rect = element.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;
    element.style.setProperty('--rx', `${(-y * 6).toFixed(2)}deg`);
    element.style.setProperty('--ry', `${(x * 8).toFixed(2)}deg`);
  };
  return <div ref={ref} className={cn('lp-tilt', className)} onPointerMove={onMove} onPointerLeave={reset}>{children}</div>;
}

/** Endless horizontal strip; pauses on hover, scrollable instead when motion is reduced. */
export function Marquee({ children, seconds = 40, className }: { children: ReactNode; seconds?: number; className?: string }) {
  return (
    <div className={cn('lp-marquee overflow-hidden', className)}>
      <div className="lp-marquee-track" style={{ '--lp-marquee-duration': `${seconds}s` } as CSSProperties}>
        <div className="flex shrink-0 items-center gap-4 pe-4">{children}</div>
        <div className="flex shrink-0 items-center gap-4 pe-4" aria-hidden="true" inert>{children}</div>
      </div>
    </div>
  );
}
