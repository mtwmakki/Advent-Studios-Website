import { prefersReducedMotion } from './env';

/**
 * Service-card videos load only when their card comes near the viewport and play only while it is
 * on screen. Under reduced motion they load (so the first frame or poster shows) but never play.
 */
export function initCardVideos(): void {
  const videos = [...document.querySelectorAll<HTMLVideoElement>('[data-card-video]')];
  if (!videos.length) return;
  const reduced = prefersReducedMotion();

  const load = (v: HTMLVideoElement) => {
    if (v.dataset.loaded) return;
    v.dataset.loaded = '1';
    v.querySelectorAll<HTMLSourceElement>('source[data-src]').forEach((s) => {
      s.src = s.dataset.src!;
    });
    v.load();
  };

  const near = new IntersectionObserver(
    (entries) => entries.forEach((e) => e.isIntersecting && load(e.target as HTMLVideoElement)),
    { rootMargin: '400px 0px' },
  );
  const onScreen = new IntersectionObserver(
    (entries) =>
      entries.forEach((e) => {
        const v = e.target as HTMLVideoElement;
        if (reduced) return;
        if (e.isIntersecting) v.play().catch(() => {});
        else v.pause();
      }),
    { threshold: 0.25 },
  );
  videos.forEach((v) => {
    near.observe(v);
    onScreen.observe(v);
  });
}
