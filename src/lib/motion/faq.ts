import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { prefersReducedMotion } from './env';

/**
 * FAQ accordion. Panels are open in the HTML (readable without JS); this collapses them and
 * wires each question button to open and close its own panel independently.
 */
export function initFaq(): void {
  const reduced = prefersReducedMotion();
  document.querySelectorAll<HTMLButtonElement>('[data-faq-toggle]').forEach((btn) => {
    const panel = document.getElementById(btn.getAttribute('aria-controls') ?? '');
    if (!panel) return;
    panel.hidden = true;
    btn.setAttribute('aria-expanded', 'false');

    btn.addEventListener('click', () => {
      const open = btn.getAttribute('aria-expanded') !== 'true';
      btn.setAttribute('aria-expanded', String(open));
      gsap.killTweensOf(panel);
      if (open) {
        panel.hidden = false;
        if (!reduced) gsap.fromTo(panel, { height: 0 }, { height: 'auto', duration: 0.5, ease: 'expo.out', onComplete: () => ScrollTrigger.refresh() });
        else ScrollTrigger.refresh();
      } else if (reduced) {
        panel.hidden = true;
        ScrollTrigger.refresh();
      } else {
        gsap.to(panel, {
          height: 0,
          duration: 0.4,
          ease: 'expo.out',
          onComplete: () => {
            panel.hidden = true;
            gsap.set(panel, { clearProps: 'height' });
            ScrollTrigger.refresh();
          },
        });
      }
    });
  });
}
