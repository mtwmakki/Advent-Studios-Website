import { gsap } from 'gsap';
import { hasFinePointer, prefersReducedMotion } from './env';

interface RectLike {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Offset of the pointer from the rect's centre, scaled by strength. */
export function magneticOffset(px: number, py: number, rect: RectLike, strength: number): { x: number; y: number } {
  return {
    x: (px - (rect.left + rect.width / 2)) * strength,
    y: (py - (rect.top + rect.height / 2)) * strength,
  };
}

/** Makes every [data-magnetic] element lean toward the pointer and spring back on leave. */
export function initMagnetic(root: ParentNode = document): void {
  if (!hasFinePointer() || prefersReducedMotion()) return;

  root.querySelectorAll<HTMLElement>('[data-magnetic]').forEach((el) => {
    if (el.dataset.magneticReady) return;
    el.dataset.magneticReady = '1';
    const strength = Number(el.dataset.magnetic) || 0.35;
    const inner = el.querySelector<HTMLElement>('[data-magnetic-inner]');
    const xTo = gsap.quickTo(el, 'x', { duration: 0.6, ease: 'power3.out' });
    const yTo = gsap.quickTo(el, 'y', { duration: 0.6, ease: 'power3.out' });
    const ixTo = inner ? gsap.quickTo(inner, 'x', { duration: 0.6, ease: 'power3.out' }) : null;
    const iyTo = inner ? gsap.quickTo(inner, 'y', { duration: 0.6, ease: 'power3.out' }) : null;

    el.addEventListener('pointerenter', (e) => {
      const r = el.getBoundingClientRect();
      // Fill sweeps in from where the pointer entered.
      el.style.setProperty('--fx', `${((e.clientX - r.left) / r.width) * 100}%`);
      el.style.setProperty('--fy', `${((e.clientY - r.top) / r.height) * 100}%`);
    });

    el.addEventListener('pointermove', (e) => {
      const o = magneticOffset(e.clientX, e.clientY, el.getBoundingClientRect(), strength);
      xTo(o.x);
      yTo(o.y);
      ixTo?.(o.x * 0.5);
      iyTo?.(o.y * 0.5);
    });

    el.addEventListener('pointerleave', (e) => {
      const r = el.getBoundingClientRect();
      el.style.setProperty('--fx', `${((e.clientX - r.left) / r.width) * 100}%`);
      el.style.setProperty('--fy', `${((e.clientY - r.top) / r.height) * 100}%`);
      gsap.to(el, { x: 0, y: 0, duration: 1, ease: 'elastic.out(1, 0.4)', overwrite: true });
      if (inner) gsap.to(inner, { x: 0, y: 0, duration: 1, ease: 'elastic.out(1, 0.4)', overwrite: true });
    });
  });
}
