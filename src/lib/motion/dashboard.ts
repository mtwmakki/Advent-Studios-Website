import { gsap } from 'gsap';
import { prefersReducedMotion } from './env';

/** Loops the hero dashboard demo; runs only while the panel is on screen. Static under reduced motion. */
export function initDashboardLoop(): void {
  const dash = document.querySelector<HTMLElement>('[data-dashboard]');
  const panel = document.getElementById('hero-panel');
  if (!dash || !panel || prefersReducedMotion()) return;

  const counters = [...dash.querySelectorAll<HTMLElement>('[data-count]')];
  const bars = dash.querySelectorAll<HTMLElement>('[data-bar]');
  const cols = dash.querySelectorAll<HTMLElement>('[data-col]');
  const row = dash.querySelector<HTMLElement>('[data-need-row="0"]');
  const pill = row?.querySelector<HTMLElement>('[data-pill]');
  const check = row?.querySelector<HTMLElement>('[data-check]');
  const pointer = dash.querySelector<HTMLElement>('#demo-pointer');
  const bugs = dash.querySelector<HTMLElement>('[data-tile="Bugs open"] [data-count]');
  if (!row || !pill || !check || !pointer) return;

  // Converts a point inside the (possibly scaled) dashboard to its unscaled coordinates.
  const local = (el: HTMLElement) => {
    const d = dash.getBoundingClientRect();
    const s = d.width / dash.offsetWidth || 1;
    const r = el.getBoundingClientRect();
    return { x: (r.left - d.left + r.width / 2) / s, y: (r.top - d.top + r.height / 2) / s };
  };
  const reset = () => {
    row.classList.remove('is-done');
    pill.textContent = pill.dataset.pillText ?? pill.textContent;
    gsap.set(row, { opacity: 1 });
  };

  const tl = gsap.timeline({ repeat: -1, repeatDelay: 0.8, repeatRefresh: true, paused: true, onRepeat: reset });

  counters.forEach((c) => {
    const end = Number(c.dataset.count);
    const o = { v: 0 };
    tl.fromTo(o, { v: 0 }, { v: end, duration: 1.4, ease: 'power3.out', onUpdate: () => { c.textContent = String(Math.round(o.v)); } }, 0);
  });
  tl.fromTo(bars, { scaleX: 0 }, { scaleX: 1, duration: 1.2, ease: 'expo.out', stagger: 0.03 }, 0.1)
    .fromTo(cols, { scaleY: 0 }, { scaleY: 1, duration: 1.2, ease: 'expo.out', stagger: 0.05 }, 0.2)
    .fromTo(
      pointer,
      { x: () => dash.offsetWidth * 0.8, y: () => dash.offsetHeight * 0.9, opacity: 0, scale: 1 },
      { opacity: 1, duration: 0.3 },
      1.8,
    )
    .to(pointer, { x: () => local(check).x - 4, y: () => local(check).y - 2, duration: 1.2, ease: 'power3.inOut' }, 1.9)
    .to(pointer, { scale: 0.8, duration: 0.12, yoyo: true, repeat: 1, ease: 'power2.out' })
    .call(() => {
      row.classList.add('is-done');
      pill.textContent = 'Done';
      if (bugs) bugs.textContent = String(Number(bugs.dataset.count) - 1);
    })
    .to(row, { opacity: 0.5, duration: 0.5 }, '<')
    .to(pointer, { x: '+=140', y: '+=90', opacity: 0, duration: 0.9, ease: 'power2.in' }, '+=0.7')
    .to({}, { duration: 2.4 });

  new IntersectionObserver(([entry]) => (entry.isIntersecting ? tl.play() : tl.pause()), { threshold: 0.15 }).observe(panel);
}
