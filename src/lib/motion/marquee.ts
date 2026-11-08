import { gsap } from 'gsap';
import { prefersReducedMotion } from './env';

const BASE_SPEED = 60; // px per second
const VELOCITY_GAIN = 36; // extra px/s per px scrolled in the last frame

/** Fills the marquee with aria-hidden copies and slides it; scroll speeds it up and sets direction. */
export function initMarquee(): void {
  const root = document.getElementById('marquee');
  const track = root?.querySelector<HTMLElement>('[data-marquee-track]');
  const item = track?.querySelector<HTMLElement>('[data-marquee-item]');
  if (!root || !track || !item) return;

  const fill = () => {
    track.querySelectorAll('[data-marquee-item][aria-hidden="true"]').forEach((n) => n.remove());
    const copies = Math.max(1, Math.ceil((window.innerWidth * 2) / item.offsetWidth));
    for (let i = 0; i < copies; i++) {
      const clone = item.cloneNode(true) as HTMLElement;
      clone.setAttribute('aria-hidden', 'true');
      track.append(clone);
    }
  };
  fill();
  if (prefersReducedMotion()) return;

  let x = 0;
  let dir = -1;
  let speed = BASE_SPEED;
  let lastY = window.scrollY;
  let visible = true;

  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
  }).observe(root);
  window.addEventListener('resize', fill);

  gsap.ticker.add((_t, dt) => {
    const dy = window.scrollY - lastY;
    lastY = window.scrollY;
    if (!visible) return;
    if (dy !== 0) dir = dy > 0 ? -1 : 1;
    const target = BASE_SPEED + Math.min(Math.abs(dy), 60) * VELOCITY_GAIN;
    speed += (target - speed) * 0.08;
    const w = item.offsetWidth;
    x += (dir * speed * dt) / 1000;
    if (x <= -w) x += w;
    if (x > 0) x -= w;
    gsap.set(track, { x });
  });
}
