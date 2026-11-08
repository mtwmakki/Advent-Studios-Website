import { gsap } from 'gsap';
import { prefersReducedMotion } from './env';

const COLLAPSE_AT = 120;
const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

function scrollToTarget(hash: string): void {
  const lenis = window.__lenis;
  const target = hash === '#top' ? 0 : document.querySelector<HTMLElement>(hash);
  if (target === null) return;
  if (lenis) {
    lenis.scrollTo(target, { offset: hash === '#top' ? 0 : -24, duration: 1.2 });
    return;
  }
  const behavior: ScrollBehavior = prefersReducedMotion() ? 'auto' : 'smooth';
  if (target === 0) window.scrollTo({ top: 0, behavior });
  else target.scrollIntoView({ behavior, block: 'start' });
}

export function initNav(): void {
  const root = document.documentElement;
  const toggle = document.getElementById('menu-toggle') as HTMLButtonElement | null;
  const menu = document.getElementById('menu');
  if (!toggle || !menu) return;
  const reduced = prefersReducedMotion();

  // Collapse the header into the round menu button once the visitor scrolls.
  let ticking = false;
  const update = () => {
    ticking = false;
    root.classList.toggle('nav-collapsed', window.scrollY > COLLAPSE_AT);
  };
  window.addEventListener('scroll', () => {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(update);
    }
  }, { passive: true });
  update();

  let open = false;

  const origin = () => {
    const r = toggle.getBoundingClientRect();
    return `${r.left + r.width / 2}px ${r.top + r.height / 2}px`;
  };

  const openMenu = () => {
    if (open) return;
    open = true;
    root.classList.add('menu-open');
    toggle.setAttribute('aria-expanded', 'true');
    toggle.setAttribute('aria-label', 'Close menu');
    menu.hidden = false;
    window.__lenis?.stop();
    document.body.style.overflow = 'hidden';
    const words = menu.querySelectorAll('[data-menu-word]');
    const foot = menu.querySelector('[data-menu-foot]');
    if (reduced) {
      gsap.set(menu, { clipPath: 'none' });
      gsap.set(words, { yPercent: 0 });
    } else {
      const at = origin();
      gsap.fromTo(menu, { clipPath: `circle(0px at ${at})` }, { clipPath: `circle(150% at ${at})`, duration: 0.8, ease: 'expo.inOut' });
      gsap.fromTo(words, { yPercent: 110 }, { yPercent: 0, duration: 0.9, ease: 'expo.out', stagger: 0.06, delay: 0.25 });
      gsap.fromTo(foot, { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.8, ease: 'expo.out', delay: 0.45 });
    }
    menu.querySelector<HTMLElement>('[data-menu-link]')?.focus();
  };

  const closeMenu = (opts: { returnFocus?: boolean } = {}) => {
    if (!open) return;
    open = false;
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'Open menu');
    const done = () => {
      menu.hidden = true;
      root.classList.remove('menu-open');
      document.body.style.overflow = '';
      window.__lenis?.start();
    };
    if (reduced) done();
    else gsap.to(menu, { clipPath: `circle(0px at ${origin()})`, duration: 0.6, ease: 'expo.inOut', onComplete: done });
    if (opts.returnFocus !== false) toggle.focus();
  };

  toggle.addEventListener('click', () => (open ? closeMenu() : openMenu()));

  document.addEventListener('keydown', (e) => {
    if (!open) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      closeMenu();
      return;
    }
    if (e.key !== 'Tab') return;
    const items = [toggle, ...menu.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null || el === toggle);
    const i = items.indexOf(document.activeElement as HTMLElement);
    e.preventDefault();
    const next = e.shiftKey ? (i <= 0 ? items.length - 1 : i - 1) : (i + 1) % items.length;
    items[next]?.focus();
  });

  // In-page links scroll smoothly; links inside the menu close it first.
  document.querySelectorAll<HTMLAnchorElement>('a[data-anchor]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const hash = a.getAttribute('href');
      if (!hash || !hash.startsWith('#')) return;
      e.preventDefault();
      if (open) closeMenu({ returnFocus: false });
      scrollToTarget(hash);
      history.replaceState(null, '', hash === '#top' ? location.pathname : hash);
    });
  });
}
