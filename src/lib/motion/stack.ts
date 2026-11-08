import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { hasFinePointer, prefersReducedMotion } from './env';

gsap.registerPlugin(ScrollTrigger);

/**
 * Service cards pin with CSS `position: sticky` (works without JS and on touch). Here we only add
 * depth: the covered card shrinks and dims while the next one slides over it, and the card art
 * drifts slightly with the pointer on desktop.
 */
export function initServiceStack(): void {
  const cards = [...document.querySelectorAll<HTMLElement>('[data-service-card]')];
  if (!cards.length || prefersReducedMotion()) return;

  cards.forEach((card, i) => {
    const next = cards[i + 1];
    if (!next) return;
    const shade = card.querySelector('[data-shade]');
    const pin = () => parseFloat(getComputedStyle(next).top) || 96;
    gsap
      .timeline({
        scrollTrigger: {
          trigger: next,
          start: 'top bottom',
          end: () => `top ${pin()}px`,
          scrub: true,
          invalidateOnRefresh: true,
        },
      })
      .to(card, { scale: 0.92, ease: 'none' }, 0)
      .to(shade, { opacity: 0.5, ease: 'none' }, 0);
  });

  if (!hasFinePointer()) return;
  cards.forEach((card) => {
    const layers = [...card.querySelectorAll<SVGGElement>('[data-art] [data-depth]')].map((el) => ({
      el,
      depth: Number(el.getAttribute('data-depth')) || 1,
    }));
    card.addEventListener('pointermove', (e) => {
      const r = card.getBoundingClientRect();
      const nx = (e.clientX - r.left) / r.width - 0.5;
      const ny = (e.clientY - r.top) / r.height - 0.5;
      layers.forEach(({ el, depth }) => gsap.to(el, { x: nx * 16 * depth, y: ny * 16 * depth, duration: 0.8, ease: 'power3.out' }));
    });
    card.addEventListener('pointerleave', () => {
      layers.forEach(({ el }) => gsap.to(el, { x: 0, y: 0, duration: 1, ease: 'elastic.out(1, 0.5)' }));
    });
  });
}
