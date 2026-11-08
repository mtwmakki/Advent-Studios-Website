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
  if (!cards.length) return;
  revealFocusedCard(cards);
  if (prefersReducedMotion()) return;

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

/** Document top of an element in normal flow (sticky offsets ignored by measuring the stack). */
function docTop(el: HTMLElement): number {
  let y = 0;
  for (let n: HTMLElement | null = el; n; n = n.offsetParent as HTMLElement | null) y += n.offsetTop;
  return y;
}

/**
 * Sticky cards cover the ones before them, so a keyboard user tabbing into an earlier card could
 * land on a hidden button. On keyboard focus, scroll so that card is the one on top of the stack.
 */
function revealFocusedCard(cards: HTMLElement[]): void {
  const stack = cards[0].parentElement as HTMLElement;
  cards.forEach((card, i) => {
    card.addEventListener('focusin', (e) => {
      const el = e.target as HTMLElement;
      if (!el.matches(':focus-visible')) return;
      const gap = parseFloat(getComputedStyle(stack).rowGap) || 0;
      let y = docTop(stack);
      for (let j = 0; j < i; j++) y += cards[j].offsetHeight + gap;
      const pin = parseFloat(getComputedStyle(card).top) || 0;
      const top = Math.max(0, y - pin);
      if (window.__lenis) window.__lenis.scrollTo(top, { duration: 0.8, force: true });
      else window.scrollTo({ top, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    });
  });
}
