// Renders the foldable's screen content for the Work section into public/fold/:
//  - fold-inner.mp4 / .jpg (H.264 plays everywhere and came out smaller than VP9 here): the full dashboard at the open screen's shape, an 8s loop
//    captured frame by frame;
//  - fold-cover.webp: the lock screen shown on the cover screen while the device is closed.
// The stage pages are built statically (no dev server) and served by a tiny local server,
// so every frame is deterministic.
// Usage: node tools/record-dashboard/record.mjs   (needs ffmpeg on PATH)
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, rmSync, existsSync, createReadStream, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { join, extname, normalize } from 'node:path';
import { tmpdir } from 'node:os';

const root = process.cwd();
const BASE = '/Advent-Studios-Website/';
const stages = {
  'fold-screen-stage': 'tools/record-dashboard/FoldScreen.astro',
  'lock-screen-stage': 'tools/record-dashboard/LockScreen.astro',
};
const build = join(tmpdir(), 'advent-record-build');
const frames = join(tmpdir(), 'advent-record-frames');
const out = join(root, 'public/fold');
const FPS = 30;
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

// 1. Build the site with the stage pages into a scratch folder, then remove the pages again.
for (const [name, file] of Object.entries(stages)) copyFileSync(join(root, file), join(root, `src/pages/${name}.astro`));
try {
  rmSync(build, { recursive: true, force: true });
  execFileSync('npx', ['astro', 'build', '--outDir', build], { cwd: root, stdio: 'ignore' });
} finally {
  for (const name of Object.keys(stages)) rmSync(join(root, `src/pages/${name}.astro`), { force: true });
}
log('stages built');

// 2. Serve the build under the site's base path.
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg' };
const server = createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (!p.startsWith(BASE)) { res.writeHead(404); return res.end(); }
  p = normalize(p.slice(BASE.length)).replace(/^(\.\.[/\\])+/, '');
  let file = join(build, p);
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  if (!existsSync(file)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': types[extname(file)] || 'application/octet-stream' });
  createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(4340, r));
const url = (name) => `http://localhost:4340${BASE}${name}/`;

try {
  mkdirSync(out, { recursive: true });
  const browser = await chromium.launch();

  // 3. Cover screen: one still image.
  {
    const tab = await browser.newPage({ viewport: { width: 414, height: 600 }, deviceScaleFactor: 2.5 });
    await tab.goto(url('lock-screen-stage'), { waitUntil: 'load' });
    await tab.evaluate(() => document.fonts.ready);
    const png = join(tmpdir(), 'advent-fold-cover.png');
    await tab.screenshot({ path: png });
    execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', png, '-c:v', 'libwebp', '-quality', '86', join(out, 'fold-cover.webp')]);
    await tab.close();
    log('cover done');
  }

  // 4. Inner screen: every frame of the 8s loop, by seeking the timeline.
  rmSync(frames, { recursive: true, force: true });
  mkdirSync(frames, { recursive: true });
  const tab = await browser.newPage({ viewport: { width: 1380, height: 1000 }, deviceScaleFactor: 1.4 });
  tab.on('pageerror', (e) => log('pageerror', e.message));
  await tab.goto(url('fold-screen-stage'), { waitUntil: 'load', timeout: 60000 });
  await tab.waitForFunction(() => !!(window).__rec, null, { timeout: 60000 });
  await tab.evaluate(() => document.fonts.ready);
  await tab.waitForTimeout(400);
  const duration = await tab.evaluate(() => (window).__rec.duration);
  const total = Math.round(duration * FPS);
  log(`capturing ${total} frames`);
  for (let f = 0; f < total; f++) {
    await tab.evaluate((t) => { (window).__rec.seek(t); }, f / FPS);
    await tab.screenshot({ path: join(frames, `f_${String(f).padStart(4, '0')}.png`) });
    if (f % 60 === 0) log(`frame ${f}/${total}`);
  }
  await browser.close();

  // 5. Encode. Keyframes every second keep seeking and looping smooth as a video texture.
  const input = ['-y', '-v', 'error', '-framerate', String(FPS), '-i', join(frames, 'f_%04d.png')];
  log('encoding mp4');
  execFileSync('ffmpeg', [...input, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '23', '-preset', 'slow', '-g', '30', '-movflags', '+faststart', join(out, 'fold-inner.mp4')]);
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', join(frames, 'f_0000.png'), '-q:v', '3', join(out, 'fold-inner.jpg')]);
  log(`done: ${total} frames (${duration.toFixed(2)}s)`);
} finally {
  server.close();
}
