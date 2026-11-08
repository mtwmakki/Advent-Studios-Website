import { gsap } from 'gsap';
import { prefersReducedMotion } from './env';

export const INTRO_KEY = 'advent-intro';

/**
 * Plays the mark intro once per session. The inline head script decides before first paint
 * whether the overlay shows at all (adds `intro-on` to <html>); this only animates it away.
 */
export function initIntro(): Promise<void> {
  const root = document.documentElement;
  const el = document.getElementById('intro');
  if (!el || !root.classList.contains('intro-on') || prefersReducedMotion()) {
    root.classList.remove('intro-on');
    return Promise.resolve();
  }
  try {
    sessionStorage.setItem(INTRO_KEY, '1');
  } catch {
    /* storage blocked: the intro may play again, which is harmless */
  }

  return new Promise((resolve) => {
    const finish = () => {
      root.classList.remove('intro-on');
      resolve();
    };
    const a = el.querySelector('[data-intro-piece="a"]');
    const b = el.querySelector('[data-intro-piece="b"]');
    gsap
      .timeline({ defaults: { ease: 'expo.out' }, onComplete: finish })
      .fromTo(a, { x: -26, y: -26, opacity: 0 }, { x: 0, y: 0, opacity: 1, duration: 0.6 }, 0)
      .fromTo(b, { x: 26, y: 26, opacity: 0 }, { x: 0, y: 0, opacity: 1, duration: 0.6 }, 0.05)
      .to(el, { yPercent: -100, duration: 0.5, ease: 'expo.inOut' }, '+=0.15');
  });
}
