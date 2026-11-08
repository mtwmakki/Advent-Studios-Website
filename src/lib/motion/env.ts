const mq = (query: string): boolean =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(query).matches;

export const prefersReducedMotion = (): boolean => mq('(prefers-reduced-motion: reduce)');

/** A mouse or trackpad that can hover: the only case that gets cursor and magnetic effects. */
export const hasFinePointer = (): boolean => mq('(pointer: fine)') && mq('(hover: hover)');

export const isMobile = (): boolean => mq('(max-width: 767px)');
