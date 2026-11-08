import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { initIntro } from './intro';
import { initSmoothScroll } from './scroll';
import { initCursor } from './cursor';
import { initMagnetic } from './magnetic';
import { initRollingText } from './roll';
import { initNav } from './nav';
import { initLineReveals } from './reveal';
import { initHeroPanel } from './hero';
import { initDashboardLoop } from './dashboard';
import { initMarquee } from './marquee';
import { initServiceStack } from './stack';
import { initFaq } from './faq';
import { initCardVideos } from './video';

function boot(): void {
  const intro = initIntro();
  initSmoothScroll();
  initRollingText();
  initNav();
  initLineReveals(document, intro);
  initHeroPanel();
  // Below-the-fold and pointer-only setup waits for an idle moment so first paint stays fast.
  const later = () => {
    initCursor();
    initMagnetic();
    initDashboardLoop();
    initMarquee();
    initServiceStack();
    initCardVideos();
    initFaq();
    ScrollTrigger.refresh();
  };
  if ('requestIdleCallback' in window) window.requestIdleCallback(later, { timeout: 600 });
  else setTimeout(later, 200);
  document.fonts?.ready.then(() => ScrollTrigger.refresh());
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
else boot();
