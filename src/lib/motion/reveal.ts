import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { prefersReducedMotion } from './env';

gsap.registerPlugin(ScrollTrigger, SplitText);

/**
 * [data-reveal] headings rise line by line from a mask when they scroll into view;
 * [data-reveal="hero"] and [data-fade] blocks wait for `heroReady` (the intro) instead.
 * Hidden-before-reveal CSS only applies under html.js:not(.reduced) and has a 3s failsafe.
 */
export function initLineReveals(root: ParentNode = document, heroReady: Promise<void> = Promise.resolve()): void {
  const heads = [...root.querySelectorAll<HTMLElement>('[data-reveal]')];
  const fades = [...root.querySelectorAll<HTMLElement>('[data-fade]')];
  const reveal = (el: HTMLElement) => el.classList.add('is-revealed');

  if (prefersReducedMotion()) {
    [...heads, ...fades].forEach(reveal);
    return;
  }

  heroReady.then(() => {
    fades.forEach((el, i) => {
      reveal(el);
      gsap.from(el, { y: 28, opacity: 0, duration: 1, ease: 'expo.out', delay: 0.35 + i * 0.1, clearProps: 'transform,opacity' });
    });
  });

  document.fonts.ready.then(() => {
    heads.forEach((el) => {
      const isHero = el.dataset.reveal === 'hero';
      let played = false;
      SplitText.create(el, {
        type: 'lines',
        mask: 'lines',
        linesClass: 'reveal-line',
        autoSplit: true,
        onSplit(self) {
          reveal(el);
          if (played) return gsap.set(self.lines, { yPercent: 0 });
          const tween = gsap.from(self.lines, {
            yPercent: 110,
            duration: 1.1,
            ease: 'expo.out',
            stagger: 0.08,
            paused: isHero,
            onComplete: () => {
              played = true;
            },
            scrollTrigger: isHero ? undefined : { trigger: el, start: 'top 85%', once: true },
          });
          if (isHero) heroReady.then(() => tween.play());
          return tween;
        },
      });
    });
  });
}
