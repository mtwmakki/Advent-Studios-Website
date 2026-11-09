import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { prefersReducedMotion } from './env';

gsap.registerPlugin(ScrollTrigger);

/** The Work statement's two lines slide apart as the heading scrolls through the screen. */
export function initWorkDrift(): void {
  const heading = document.querySelector<HTMLElement>('#work .work__statement');
  if (!heading || prefersReducedMotion()) return;
  const lines = heading.querySelectorAll<HTMLElement>('[data-drift]');
  lines.forEach((line) => {
    const dir = line.dataset.drift === 'left' ? -1 : 1;
    gsap.fromTo(
      line,
      { xPercent: 0, x: () => -dir * window.innerWidth * 0.03 },
      {
        x: () => dir * window.innerWidth * 0.05,
        ease: 'none',
        scrollTrigger: { trigger: heading, start: 'top bottom', end: 'bottom top', scrub: 0.6, invalidateOnRefresh: true },
      },
    );
  });
}
