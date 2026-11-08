// Renders the Work-section footage: the full dashboard inside a laptop, frame by frame,
// then encodes MP4 (H.264) + WebM (VP9) + a poster into public/videos/.
// The stage page is built statically (no dev server) and served by a tiny local server,
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
const page = join(root, 'src/pages/record-stage.astro');
const build = join(tmpdir(), 'advent-record-build');
const frames = join(tmpdir(), 'advent-record-frames');
const out = join(root, 'public/videos');
const FPS = 30;
const SCALE = 1.25; // 1920x1200 stage -> 2400x1500 frames
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

// 1. Build the site with the stage page into a scratch folder, then remove the page again.
copyFileSync(join(root, 'tools/record-dashboard/Record.astro'), page);
try {
  rmSync(build, { recursive: true, force: true });
  execFileSync('npx', ['astro', 'build', '--outDir', build], { cwd: root, stdio: 'ignore' });
} finally {
  if (existsSync(page)) rmSync(page);
}
log('stage built');

// 2. Serve the build under the site's base path.
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.mp4': 'video/mp4', '.webm': 'video/webm' };
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

try {
  rmSync(frames, { recursive: true, force: true });
  mkdirSync(frames, { recursive: true });
  mkdirSync(out, { recursive: true });

  // 3. Capture every frame of the 8s loop by seeking the timeline.
  const browser = await chromium.launch();
  const tab = await browser.newPage({ viewport: { width: 1920, height: 1200 }, deviceScaleFactor: SCALE });
  tab.on('pageerror', (e) => log('pageerror', e.message));
  await tab.goto(`http://localhost:4340${BASE}record-stage/`, { waitUntil: 'load', timeout: 60000 });
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

  // 4. Encode.
  const input = ['-y', '-v', 'error', '-framerate', String(FPS), '-i', join(frames, 'f_%04d.png')];
  log('encoding mp4');
  execFileSync('ffmpeg', [...input, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '24', '-preset', 'slow', '-movflags', '+faststart', join(out, 'work-dashboard.mp4')]);
  log('encoding webm');
  execFileSync('ffmpeg', [...input, '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '38', '-row-mt', '1', '-deadline', 'good', '-cpu-used', '4', join(out, 'work-dashboard.webm')]);
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', join(frames, 'f_0000.png'), '-vf', 'scale=1920:-1', '-q:v', '4', join(out, 'work-dashboard.jpg')]);
  log(`done: ${total} frames (${duration.toFixed(2)}s)`);
} finally {
  server.close();
}
