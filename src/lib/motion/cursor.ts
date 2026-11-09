import { gsap } from 'gsap';
import MouseFollower from 'mouse-follower';
import 'mouse-follower/dist/mouse-follower.min.css';
import { hasFinePointer, prefersReducedMotion } from './env';

let follower: MouseFollower | null = null;

/** The cursor follower, once it exists (desktop with motion only). */
export const cursorFollower = (): MouseFollower | null => follower;

/** Cursor follower: a small glass bead that grows with a label and sticks to big buttons. Desktop only. */
export function initCursor(): void {
  if (!hasFinePointer() || prefersReducedMotion()) return;
  if (document.querySelector('.mf-cursor')) return;

  MouseFollower.registerGSAP(gsap);
  follower = new MouseFollower({
    speed: 0.55,
    ease: 'expo.out',
    skewing: 1.2,
    skewingText: 1.2,
    stateDetection: {
      '-pointer': 'a, button, a *, button *',
      '-dark': '[data-cursor-dark], [data-cursor-dark] *',
      '-hidden': 'input, textarea, select, iframe',
    },
  });
}
