import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { prefersReducedMotion } from './env';

gsap.registerPlugin(ScrollTrigger);

/** The Work statement's two lines slide apart as the heading scrolls through the screen. */
export function initWorkDrift(): void {
  const heading = document.querySelector<HTMLElement>('#work .work__statement');
  if (!heading || prefersReducedMotion()) return;
  const lines = heading.querySelectorAll<HTMLElement>('[data-drift]');
  lines.forEach((line) => {
    const dir = line.dataset.drift === 'left' ? -1 : 1;
    gsap.fromTo(
      line,
      { xPercent: 0, x: () => -dir * window.innerWidth * 0.03 },
      {
        x: () => dir * window.innerWidth * 0.05,
        ease: 'none',
        scrollTrigger: { trigger: heading, start: 'top bottom', end: 'bottom top', scrub: 0.6, invalidateOnRefresh: true },
      },
    );
  });
}

/** Without WebGL the DOM player plays the footage itself, only while it is on screen. */
export function initWorkVideoFallback(): void {
  const video = document.querySelector<HTMLVideoElement>('#work [data-melt-video]');
  if (!video || prefersReducedMotion()) return;
  const io = new IntersectionObserver(([e]) => {
    if (e.isIntersecting) video.play().catch(() => {});
    else video.pause();
  }, { threshold: 0.15 });
  io.observe(video);
}
