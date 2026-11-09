import { prefersReducedMotion } from './env';

/**
 * The Signal-orange thread: one continuous line from the Work statement down to the footer's
 * WhatsApp button, drawn as you scroll so its head stays a little below the middle of the screen.
 * It sits behind section content (text is drawn over it, opaque cards and panels hide it) and
 * above the footer, where it plugs into the call to action.
 */

type Pt = { x: number; y: number; anchor?: boolean };
const SVG_NS = 'http://www.w3.org/2000/svg';

const docRect = (el: Element) => {
  const r = el.getBoundingClientRect();
  return { l: r.left + window.scrollX, t: r.top + window.scrollY, r: r.right + window.scrollX, b: r.bottom + window.scrollY, w: r.width, h: r.height };
};

/**
 * Centripetal Catmull-Rom spline through the points, as cubic Béziers. The centripetal form
 * never makes cusps or little knots where waypoints are unevenly spaced. Control points are kept
 * inside [inset, width - inset]; a Bézier never leaves the hull of its control points, so the line
 * never runs off the side of the screen (except where a point is placed off-screen on purpose).
 */
type Seg = [Pt, Pt, Pt, Pt];

function smoothPath(pts: Pt[], width: number, inset: number): { d: string; segs: Seg[] } {
  const cx = (x: number) => Math.min(width - inset, Math.max(inset, x));
  const dist = (a: Pt, b: Pt) => Math.max(1e-3, Math.sqrt(Math.hypot(b.x - a.x, b.y - a.y)));
  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  const segs: Seg[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p0 = pts[i - 1] ?? { x: 2 * p1.x - p2.x, y: 2 * p1.y - p2.y };
    const p3 = pts[i + 2] ?? { x: 2 * p2.x - p1.x, y: 2 * p2.y - p1.y };
    const d1 = dist(p0, p1), d2 = dist(p1, p2), d3 = dist(p2, p3);
    const a1 = 2 * d1 * d1 + 3 * d1 * d2 + d2 * d2, n1 = 3 * d1 * (d1 + d2);
    const a2 = 2 * d3 * d3 + 3 * d3 * d2 + d2 * d2, n2 = 3 * d3 * (d3 + d2);
    const c1 = {
      x: (d1 * d1 * p2.x - d2 * d2 * p0.x + a1 * p1.x) / n1,
      y: (d1 * d1 * p2.y - d2 * d2 * p0.y + a1 * p1.y) / n1,
    };
    const c2 = {
      x: (d3 * d3 * p1.x - d2 * d2 * p3.x + a2 * p2.x) / n2,
      y: (d3 * d3 * p1.y - d2 * d2 * p3.y + a2 * p2.y) / n2,
    };
    if (p1.x >= 0) c1.x = cx(c1.x);
    if (p2.x >= 0) c2.x = cx(c2.x);
    d += ` C ${c1.x.toFixed(1)} ${c1.y.toFixed(1)}, ${c2.x.toFixed(1)} ${c2.y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
    segs.push([p1, c1, c2, p2]);
  }
  return { d, segs };
}

/** Length of a cubic Bézier, by flattening it into short straight pieces. */
function segLength([a, b, c, e]: Seg): number {
  let len = 0, px = a.x, py = a.y;
  for (let i = 1; i <= 32; i++) {
    const t = i / 32, u = 1 - t;
    const x = u * u * u * a.x + 3 * u * u * t * b.x + 3 * u * t * t * c.x + t * t * t * e.x;
    const y = u * u * u * a.y + 3 * u * u * t * b.y + 3 * u * t * t * c.y + t * t * t * e.y;
    len += Math.hypot(x - px, y - py);
    px = x; py = y;
  }
  return len;
}

function waypoints(top: number, width: number): Pt[] | null {
  const q = (s: string) => document.querySelector(s);
  const statement = q('#work h2'), intro = q('#work .work__intro'), fold = q('#work [data-fold]'),
    story = q('#work .work__grid'), about = q('#about'), marquee = q('#marquee'), services = q('#services'),
    faq = q('#faq'), footer = q('footer'), cta = q('footer a.btn--xl'), container = q('#work .container');
  if (!statement || !intro || !fold || !story || !about || !marquee || !services || !faq || !footer || !cta || !container) return null;

  const S = docRect(statement), I = docRect(intro), Fo = docRect(fold), St = docRect(story), A = docRect(about),
    M = docRect(marquee), Sv = docRect(services), F = docRect(faq), Ft = docRect(footer), C = docRect(cta), K = docRect(container);
  const vh = window.innerHeight;
  const y = (v: number) => v - top;
  // Desktop: halfway into the page margin. Phone: inside the 16px gutter, clear of the text.
  const edgeL = width < 900 ? Math.max(5, K.l * 0.4) : Math.max(14, K.l * 0.55);
  const edgeR = width - edgeL;
  const narrow = width < 900;
  // Ends tucked under the top edge of the button, so the line reads as plugging into it.
  const end = { x: C.l + C.w / 2, y: y(C.t + Math.min(26, C.h * 0.18)) };
  // While the foldable is pinned, the line runs down the margin beside it like a progress rail.
  const railTop = y(Fo.t + vh * 0.35);
  const railBottom = y(Fo.b - vh * 0.35);

  if (narrow) {
    return [
      { x: -20, y: y(S.t + S.h * 0.3), anchor: true },
      { x: width * 0.55, y: y(S.t + S.h * 0.55) },
      { x: edgeR, y: y(S.b + 10), anchor: true },
      { x: edgeR, y: y(I.b), anchor: true },
      { x: edgeR, y: railTop, anchor: true },
      { x: edgeR, y: railBottom, anchor: true },
      { x: width * 0.5, y: y(Fo.b + 20) },
      { x: edgeL, y: y(St.t + 40), anchor: true },
      { x: edgeL, y: y(St.b), anchor: true },
      { x: edgeL, y: y(A.b), anchor: true },
      { x: width * 0.5, y: y(M.t + M.h * 0.5) },
      { x: edgeR, y: y(M.b), anchor: true },
      { x: edgeR, y: y(Sv.b), anchor: true },
      { x: edgeR, y: y(F.b), anchor: true },
      { x: width * 0.6, y: y(Ft.t + 40), anchor: true },
      { x: end.x + 24, y: end.y - 90, anchor: true },
      { x: end.x, y: end.y, anchor: true },
    ];
  }
  return [
    { x: -20, y: y(S.t + S.h * 0.32), anchor: true },
    { x: S.l + S.w * 0.55, y: y(S.t + S.h * 0.18) },
    { x: Math.min(edgeR, S.r + 40), y: y(S.t + S.h * 0.5), anchor: true },
    // Back under the statement, past the intro, and into the left margin.
    { x: I.l + I.w * 0.45, y: y(S.b + (I.t - S.b) * 0.55) },
    { x: I.l - 70, y: y(I.t + I.h * 0.5), anchor: true },
    { x: K.l + 60, y: y(I.b + 70), anchor: true },
    { x: edgeL, y: railTop, anchor: true },
    { x: edgeL, y: railBottom, anchor: true },
    // Down through the story, About's label column, then across the marquee.
    { x: edgeL, y: y(St.b), anchor: true },
    { x: K.l + 170, y: y(A.t + A.h * 0.45), anchor: true },
    { x: K.l + 220, y: y(A.b - 30), anchor: true },
    { x: width * 0.55, y: y(M.t + M.h * 0.55), anchor: true },
    { x: edgeR, y: y(M.b + 40), anchor: true },
    // Behind the service cards and the offer panel, out into the FAQ's label column.
    { x: width * 0.6, y: y(Sv.t + Sv.h * 0.5), anchor: true },
    { x: K.l + 120, y: y(F.t + F.h * 0.55), anchor: true },
    // Into the footer, plugging into the WhatsApp button.
    { x: width * 0.45, y: y(Ft.t + 70), anchor: true },
    { x: end.x - 40, y: end.y - 120, anchor: true },
    { x: end.x, y: end.y, anchor: true },
  ];
}

export function initThread(): () => void {
  const work = document.getElementById('work');
  const footer = document.querySelector('footer');
  if (!work || !footer) return () => {};
  const reduced = prefersReducedMotion();

  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('data-thread', '');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.classList.add('thread');
  const path = document.createElementNS(SVG_NS, 'path');
  svg.appendChild(path);
  document.body.appendChild(svg);

  let total = 0;
  let top = 0;
  let anchors: { y: number; len: number }[] = [];

  const draw = () => {
    if (!total) return;
    let len = total;
    if (!reduced) {
      const head = window.scrollY + window.innerHeight * 0.62 - top;
      if (head <= anchors[0].y) len = 0;
      else if (head >= anchors[anchors.length - 1].y) len = total;
      else {
        for (let i = 0; i < anchors.length - 1; i++) {
          const a = anchors[i], b = anchors[i + 1];
          if (head >= a.y && head < b.y) {
            len = a.len + ((head - a.y) / Math.max(1, b.y - a.y)) * (b.len - a.len);
            break;
          }
        }
      }
    }
    path.style.strokeDashoffset = String(Math.max(0, total - len));
  };

  const build = () => {
    const width = document.documentElement.clientWidth;
    top = docRect(work).t;
    const bottom = docRect(footer).b;
    const pts = waypoints(top, width);
    if (!pts) return;
    svg.style.top = `${top}px`;
    svg.setAttribute('width', String(width));
    svg.setAttribute('height', String(Math.max(1, bottom - top)));
    svg.setAttribute('viewBox', `0 0 ${width} ${Math.max(1, bottom - top)}`);
    const stroke = width < 900 ? 5 : 14;
    const { d, segs } = smoothPath(pts, width, width < 900 ? 4 : 32);
    path.setAttribute('d', d);
    path.style.strokeWidth = String(stroke);
    total = path.getTotalLength();
    path.style.strokeDasharray = String(total);

    // Arc length at each anchor waypoint (anchor y only increases), for the scroll -> length mapping.
    // Waypoints are segment ends, so the lengths add up segment by segment; scaled to the browser's total.
    const lens = segs.map(segLength);
    const scale = total / Math.max(1, lens.reduce((sum, l) => sum + l, 0));
    anchors = [];
    let acc = 0;
    let lastY = -Infinity;
    pts.forEach((p, i) => {
      if (i > 0) acc += lens[i - 1] * scale;
      if (!p.anchor) return;
      const ay = Math.max(p.y, lastY + 1);
      lastY = ay;
      anchors.push({ y: ay, len: Math.min(total, acc) });
    });
    anchors[anchors.length - 1].len = total;
    draw();
  };

  let ticking = false;
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { ticking = false; draw(); });
  };
  let t = 0;
  const schedule = () => { clearTimeout(t); t = window.setTimeout(build, 120); };

  build();
  document.fonts?.ready.then(build);
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', schedule);
  const ro = new ResizeObserver(schedule);
  ro.observe(document.body);

  return () => {
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('resize', schedule);
    ro.disconnect();
    svg.remove();
  };
}
