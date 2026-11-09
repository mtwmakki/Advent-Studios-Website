import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { initIntro } from './intro';
import { initSmoothScroll } from './scroll';
import { initCursor } from './cursor';
import { initGlass } from './glass';
import { initMagnetic } from './magnetic';
import { initRollingText } from './roll';
import { initNav } from './nav';
import { initLineReveals } from './reveal';
import { initWorkDrift } from './work';
import { initThread } from './thread';
import { prefersReducedMotion } from './env';
import { initMarquee } from './marquee';
import { initServiceStack } from './stack';
import { initFaq } from './faq';
import { initCardVideos } from './video';

/** Loads the 3D foldable once the Work section is close. Without WebGL it stays a still image. */
function initWorkFold(): void {
  const track = document.querySelector<HTMLElement>('#work [data-fold]');
  if (!track || prefersReducedMotion()) return;
  const fallBack = () => track.classList.add('fold--static');
  const io = new IntersectionObserver(([e]) => {
    if (!e.isIntersecting) return;
    io.disconnect();
    import('./fold')
      .then(({ initFold }) => initFold(track))
      .then((fold) => { if (!fold) fallBack(); })
      .catch(fallBack);
  }, { rootMargin: '100% 0px' });
  io.observe(track);
}

/** Runs `fn` once the visitor first scrolls or uses the keyboard, or right away if the page opened scrolled down. */
function onFirstScroll(fn: () => void): void {
  if (window.scrollY > 0) {
    fn();
    return;
  }
  const events = ['scroll', 'wheel', 'touchstart', 'keydown'] as const;
  const go = () => {
    events.forEach((e) => window.removeEventListener(e, go));
    fn();
  };
  events.forEach((e) => window.addEventListener(e, go, { passive: true }));
}

const idle = (fn: () => void) =>
  'requestIdleCallback' in window ? window.requestIdleCallback(fn, { timeout: 600 }) : setTimeout(fn, 50);

function boot(): void {
  const intro = initIntro();
  initSmoothScroll();
  initRollingText();
  initNav();
  initLineReveals(document, intro);
  initWorkDrift();
  // Below-the-fold and pointer-only setup runs in small idle-time steps so first paint stays fast.
  const steps = [initCursor, initMagnetic, initMarquee, initGlass, initServiceStack, initCardVideos, initFaq, () => ScrollTrigger.refresh()];
  const next = () => {
    const step = steps.shift();
    if (!step) return;
    step();
    idle(next);
  };
  idle(next);
  // The Work foldable and the thread are far below the first screen: set them up on the first scroll.
  onFirstScroll(() => idle(() => {
    initThread();
    initWorkFold();
  }));
  document.fonts?.ready.then(() => ScrollTrigger.refresh());
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
else boot();
