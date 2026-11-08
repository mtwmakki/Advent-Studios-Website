import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { initIntro } from './intro';
import { initSmoothScroll } from './scroll';
import { initCursor } from './cursor';
import { initMagnetic } from './magnetic';
import { initRollingText } from './roll';
import { initNav } from './nav';

function boot(): void {
  const intro = initIntro();
  initSmoothScroll();
  initCursor();
  initRollingText();
  initMagnetic();
  initNav();
  void intro;
  document.fonts?.ready.then(() => ScrollTrigger.refresh());
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
else boot();
