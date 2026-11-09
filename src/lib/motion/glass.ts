import { gsap } from 'gsap';
import { hasFinePointer, prefersReducedMotion } from './env';
import { cursorFollower } from './cursor';

/**
 * Liquid glass over the hero and the marquee: when the pointer is over one of them, the small
 * glass cursor swells into a round lens that magnifies a live copy of what is underneath, with
 * refraction and a slight colour split at its rim. Leaving shrinks it back into the glass cursor;
 * over links and buttons it steps aside so their hover effects show. Desktop only; off for touch
 * screens and reduced motion.
 */

const SIZE = 220;
const R = SIZE / 2;
const ZOOM = 1.4;
const BEAD = 24; // the glass cursor's diameter (48px x 0.5)
const SVG_NS = 'http://www.w3.org/2000/svg';

/** Displacement map for the rim: the outer ring samples from further in, so edges bulge like a lens. */
function displacementMap(size: number): string {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  const r = size / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (x + 0.5 - r) / r, dy = (y + 0.5 - r) / r;
      const d = Math.hypot(dx, dy);
      let ox = 0, oy = 0;
      if (d > 0 && d <= 1) {
        // Only the outer ring bends, more and more towards the edge.
        const t = Math.max(0, (d - 0.7) / 0.3);
        const f = t * t;
        ox = (-dx / d) * f;
        oy = (-dy / d) * f;
      }
      const i = (y * size + x) * 4;
      img.data[i] = 128 + ox * 127;
      img.data[i + 1] = 128 + oy * 127;
      img.data[i + 2] = 128;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c.toDataURL('image/png');
}

/** SVG filter: three displacements of different strength, one per colour channel, recombined. */
function refractionFilter(): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('width', '0');
  svg.setAttribute('height', '0');
  svg.setAttribute('aria-hidden', 'true');
  svg.style.position = 'absolute';
  const filter = document.createElementNS(SVG_NS, 'filter');
  filter.id = 'glass-refract';
  filter.setAttribute('x', '0');
  filter.setAttribute('y', '0');
  filter.setAttribute('width', '100%');
  filter.setAttribute('height', '100%');
  filter.setAttribute('color-interpolation-filters', 'sRGB');
  const map = displacementMap(SIZE);
  const image = document.createElementNS(SVG_NS, 'feImage');
  image.setAttribute('href', map);
  image.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', map);
  image.setAttribute('x', '0');
  image.setAttribute('y', '0');
  image.setAttribute('width', String(SIZE));
  image.setAttribute('height', String(SIZE));
  image.setAttribute('preserveAspectRatio', 'none');
  image.setAttribute('result', 'map');
  filter.appendChild(image);
  const channels: [string, number, string][] = [
    // A light touch: about 13px of bend at the very rim, and a 1-2px colour fringe.
    ['r', 27, '1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0'],
    ['g', 24, '0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0'],
    ['b', 21, '0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0'],
  ];
  for (const [name, scale, matrix] of channels) {
    const d = document.createElementNS(SVG_NS, 'feDisplacementMap');
    d.setAttribute('in', 'SourceGraphic');
    d.setAttribute('in2', 'map');
    d.setAttribute('scale', String(scale));
    d.setAttribute('xChannelSelector', 'R');
    d.setAttribute('yChannelSelector', 'G');
    d.setAttribute('result', `d${name}`);
    const m = document.createElementNS(SVG_NS, 'feColorMatrix');
    m.setAttribute('in', `d${name}`);
    m.setAttribute('type', 'matrix');
    m.setAttribute('values', matrix);
    m.setAttribute('result', name);
    filter.append(d, m);
  }
  const rg = document.createElementNS(SVG_NS, 'feBlend');
  rg.setAttribute('in', 'r');
  rg.setAttribute('in2', 'g');
  rg.setAttribute('mode', 'screen');
  rg.setAttribute('result', 'rg');
  const rgb = document.createElementNS(SVG_NS, 'feBlend');
  rgb.setAttribute('in', 'rg');
  rgb.setAttribute('in2', 'b');
  rgb.setAttribute('mode', 'screen');
  filter.append(rg, rgb);
  svg.appendChild(filter);
  return svg;
}

/** A part of the page the lens works over: a live copy of it is magnified inside the glass. */
type Zone = {
  el: HTMLElement;
  /** Elements drawn over the zone that belong in the copy too (the nav over the hero). */
  extras?: HTMLElement[];
  /** Pointer over these: the lens steps aside so the normal cursor and hover effects show. */
  avoid?: string;
  /** Keeps a moving part of the copy in step with the page, every frame. */
  follow?: (copy: HTMLElement) => () => void;
};

const stripIds = (root: HTMLElement) => {
  [root, ...root.querySelectorAll<HTMLElement>('[id]')].forEach((n) => n.removeAttribute('id'));
  root.removeAttribute('aria-label');
  root.removeAttribute('aria-labelledby');
};

export function initGlass(): void {
  if (!hasFinePointer() || prefersReducedMotion()) return;
  if (document.querySelector('[data-glass-lens]')) return;
  const zones: Zone[] = [];
  const hero = document.getElementById('hero');
  const nav = document.getElementById('site-nav');
  if (hero) zones.push({ el: hero, extras: nav ? [nav] : [], avoid: 'a, button, [role="button"], input, label' });
  const marquee = document.getElementById('marquee');
  const track = marquee?.querySelector<HTMLElement>('[data-marquee-track]');
  if (marquee && track) {
    zones.push({
      el: marquee,
      follow: (copy) => {
        const copyTrack = copy.querySelector<HTMLElement>('[data-marquee-track]');
        return () => { if (copyTrack) copyTrack.style.transform = track.style.transform; };
      },
    });
  }
  if (!zones.length) return;

  document.body.appendChild(refractionFilter());
  const lens = document.createElement('div');
  lens.className = 'glass-lens';
  lens.setAttribute('data-glass-lens', '');
  lens.setAttribute('aria-hidden', 'true');
  const view = document.createElement('div');
  view.className = 'glass-lens__view';
  const content = document.createElement('div');
  content.className = 'glass-lens__content';
  content.setAttribute('data-glass-content', '');
  content.inert = true;
  const rim = document.createElement('div');
  rim.className = 'glass-lens__rim';
  view.appendChild(content);
  lens.append(view, rim);
  document.body.appendChild(lens);

  const root = document.documentElement;
  const state = { s: BEAD / SIZE };
  let px = -1e4, py = -1e4; // pointer
  let cx = px, cy = py; // lens centre, trailing the pointer like liquid
  let current: Zone | null = null;
  let follow: (() => void) | null = null;
  const visible = new Set<HTMLElement>();

  const fill = (zone: Zone) => {
    const r = zone.el.getBoundingClientRect();
    const copy = zone.el.cloneNode(true) as HTMLElement;
    stripIds(copy);
    copy.style.width = `${zone.el.offsetWidth}px`;
    copy.style.margin = '0';
    const parts: HTMLElement[] = [copy];
    for (const extra of zone.extras ?? []) {
      const xr = extra.getBoundingClientRect();
      const holder = document.createElement('div');
      holder.style.cssText = `position:absolute;left:${xr.left - r.left}px;top:${xr.top - r.top}px;width:${xr.width}px;height:${xr.height}px;`;
      const c = extra.cloneNode(true) as HTMLElement;
      stripIds(c);
      holder.appendChild(c);
      parts.push(holder);
    }
    content.replaceChildren(...parts);
    content.style.width = `${r.width}px`;
    content.style.height = `${r.height}px`;
    follow = zone.follow ? zone.follow(copy) : null;
  };

  const show = (zone: Zone) => {
    if (current === zone) return;
    const wasOpen = !!current;
    current?.el.classList.remove('has-lens');
    current = zone;
    fill(zone);
    zone.el.classList.add('has-lens');
    if (wasOpen) return; // moving straight from one zone to another: just swap the copy
    cx = px; cy = py;
    cursorFollower()?.hide();
    gsap.killTweensOf(state);
    gsap.to(lens, { opacity: 1, duration: 0.15, overwrite: true });
    gsap.to(view, { opacity: 1, duration: 0.2, overwrite: true });
    gsap.to(state, { s: 1, duration: 0.8, ease: 'elastic.out(1, 0.6)' });
  };
  const hide = () => {
    if (!current) return;
    current.el.classList.remove('has-lens');
    current = null;
    gsap.killTweensOf(state);
    // The magnified copy fades first, so what shrinks back into the cursor is clear glass.
    gsap.to(view, { opacity: 0, duration: 0.12, overwrite: true });
    gsap.to(state, {
      s: BEAD / SIZE,
      duration: 0.3,
      ease: 'power3.in',
      onComplete: () => {
        gsap.to(lens, { opacity: 0, duration: 0.1, overwrite: true });
        cursorFollower()?.show();
        content.replaceChildren();
        follow = null;
      },
    });
  };

  // Which zone the pointer is over, if any, and whether the lens should step aside there.
  const zoneAt = (): Zone | null => {
    if (root.classList.contains('intro-on') || root.classList.contains('menu-open')) return null;
    for (const zone of zones) {
      if (!visible.has(zone.el)) continue;
      const r = zone.el.getBoundingClientRect();
      if (px < r.left || px > r.right || py < r.top || py > r.bottom) continue;
      if (zone.avoid && document.elementFromPoint(px, py)?.closest(zone.avoid)) return null;
      return zone;
    }
    return null;
  };

  window.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    px = e.clientX; py = e.clientY;
  }, { passive: true });
  document.addEventListener('mouseleave', hide);

  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      const el = e.target as HTMLElement;
      if (e.isIntersecting) visible.add(el);
      else { visible.delete(el); if (current?.el === el) hide(); }
    }
  });
  zones.forEach((z) => io.observe(z.el));

  gsap.ticker.add(() => {
    if (!visible.size && !current) return;
    // Zones can scroll in or out from under a still pointer, so check every frame.
    const zone = zoneAt();
    if (zone) show(zone);
    else hide();
    if (!current && state.s <= BEAD / SIZE + 0.001) return;
    cx += (px - cx) * 0.24;
    cy += (py - cy) * 0.24;
    lens.style.transform = `translate3d(${cx - R}px, ${cy - R}px, 0) scale(${state.s})`;
    const el = (current ?? zones.find((z) => z.el.classList.contains('has-lens')))?.el;
    if (el) {
      const m = el.getBoundingClientRect();
      content.style.transform = `translate3d(${R + (m.left - cx) * ZOOM}px, ${R + (m.top - cy) * ZOOM}px, 0) scale(${ZOOM})`;
    }
    follow?.();
  });
}
