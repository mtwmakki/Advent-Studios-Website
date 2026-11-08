import Lenis from 'lenis';
import 'lenis/dist/lenis.css';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { hasFinePointer, prefersReducedMotion } from './env';

gsap.registerPlugin(ScrollTrigger);

/** Inertia scroll on desktop only; touch devices and reduced motion keep native scroll. */
export function initSmoothScroll(): Lenis | null {
  window.__lenis = null;
  if (prefersReducedMotion() || !hasFinePointer()) return null;

  const lenis = new Lenis({ lerp: 0.09, wheelMultiplier: 1, smoothWheel: true });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
  window.__lenis = lenis;
  return lenis;
}
