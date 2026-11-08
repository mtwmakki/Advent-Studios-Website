import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { prefersReducedMotion } from './env';

gsap.registerPlugin(ScrollTrigger);

const RADIUS = 24;

/** The hero panel starts scaled to the page margins and grows to full width as it scrolls up. */
export function initHeroPanel(): void {
  const panel = document.getElementById('hero-panel');
  const text = document.querySelector<HTMLElement>('#hero .container');
  if (!panel || !text) return;

  const contained = (): number => {
    const cs = getComputedStyle(text);
    const inner = text.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    return Math.min(1, inner / panel.offsetWidth);
  };
  const setRest = () => {
    const s = contained();
    document.documentElement.style.setProperty('--panel-s', String(s));
    gsap.set(panel, { scale: s, borderRadius: RADIUS / s });
  };

  if (prefersReducedMotion()) {
    setRest();
    window.addEventListener('resize', setRest);
    return;
  }

  setRest();
  gsap.fromTo(
    panel,
    { scale: () => contained(), borderRadius: () => RADIUS / contained() },
    {
      scale: 1,
      borderRadius: 0,
      ease: 'none',
      scrollTrigger: {
        trigger: panel,
        start: 'top 85%',
        end: 'top top',
        scrub: 0.8,
        invalidateOnRefresh: true,
      },
    },
  );
}
