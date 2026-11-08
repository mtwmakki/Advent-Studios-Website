import { gsap } from 'gsap';
import MouseFollower from 'mouse-follower';
import 'mouse-follower/dist/mouse-follower.min.css';
import { hasFinePointer, prefersReducedMotion } from './env';

/** Cursor follower: Obsidian dot that grows with a label; Bone over dark areas. Desktop only. */
export function initCursor(): void {
  if (!hasFinePointer() || prefersReducedMotion()) return;
  if (document.querySelector('.mf-cursor')) return;

  MouseFollower.registerGSAP(gsap);
  new MouseFollower({
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
