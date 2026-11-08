import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { initSmoothScroll } from './scroll';
import { initCursor } from './cursor';
import { initMagnetic } from './magnetic';
import { initRollingText } from './roll';

function boot(): void {
  initSmoothScroll();
  initCursor();
  initRollingText();
  initMagnetic();
  document.fonts?.ready.then(() => ScrollTrigger.refresh());
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
else boot();
