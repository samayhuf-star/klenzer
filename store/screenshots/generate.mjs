#!/usr/bin/env node
/**
 * Store screenshots from the real Ai Klenzer UI.
 *
 * Renders the app on Expo web with a sample library (generated images only),
 * captures each screen with Chrome, and frames it on a blue-on-white background.
 *
 *   cd store/screenshots && npm install && node generate.mjs
 *
 * Outputs:
 *   app-store/6.7-inch  1290×2796
 *   app-store/6.5-inch  1242×2688
 *   play/1080x2400
 *   play/1080x1920
 */
import { execFileSync, spawn } from 'node:child_process';
import { copyFileSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const sharp = require('sharp');
const { chromium } = require('playwright-core');

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '../..');
const PUBLIC = join(ROOT, 'public/shot-samples');
const RAW = join(HERE, 'raw');
const PORT = 8091;
const BASE = `http://127.0.0.1:${PORT}`;

const SHOTS = [
  { id: 'home', file: '01-scan-free-forever', caption: 'Scan free forever', ready: '41.2 GB' },
  // Absolute scroll keeps the storage ring below the island while the category bars stay on screen.
  { id: 'scanning', file: '02-leave-it-running', caption: 'Leave it running', ready: 'leave the app running', scrollTop: 128, pause: 1300 },
  { id: 'results', file: '03-find-gbs', caption: 'Find GBs in seconds', ready: '4.7 GB', scroll: 'What we found', scrollOffset: 66 },
  { id: 'duplicates', file: '04-keep-the-best', caption: 'Keep the best shot', ready: 'Best' },
  { id: 'control', file: '05-you-stay-in-control', caption: 'You stay in control', ready: "Don't Allow" },
  { id: 'privacy', file: '06-on-your-phone', caption: '100% on your phone', ready: 'never uploaded' },
];

const EXPORTS = [
  { dir: 'app-store/6.7-inch', w: 1290, h: 2796 },
  { dir: 'app-store/6.5-inch', w: 1242, h: 2688 },
  { dir: 'play/1080x2400', w: 1080, h: 2400 },
  { dir: 'play/1080x1920', w: 1080, h: 1920 },
];

const esc = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;');

function svg(body, w, h) {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${body}</svg>`);
}

/** A square scene. Two crops of the same render read as near-identical photos. */
function landscape({ sky0, sky1, sky2, sun, hill, hill2, water }) {
  const W = 1400;
  const H = 1400;
  const sunX = 980;
  const sunY = 340;
  return svg(
    `
    <defs>
      <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${sky0}"/>
        <stop offset="0.55" stop-color="${sky1}"/>
        <stop offset="1" stop-color="${sky2}"/>
      </linearGradient>
      <linearGradient id="water" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${water}" stop-opacity="0.95"/>
        <stop offset="1" stop-color="${sky2}"/>
      </linearGradient>
    </defs>
    <rect width="${W}" height="${H}" fill="url(#sky)"/>
    <circle cx="${sunX}" cy="${sunY}" r="92" fill="${sun}" opacity="0.95"/>
    <circle cx="${sunX}" cy="${sunY}" r="150" fill="${sun}" opacity="0.28"/>
    <circle cx="180" cy="220" r="70" fill="#0B1020" opacity="0.18"/>
    <path d="M0 760 C 180 640, 320 820, 520 700 C 760 560, 900 780, 1400 620 L 1400 980 L 0 980 Z" fill="${hill}" opacity="0.95"/>
    <path d="M0 860 C 240 760, 420 920, 700 800 C 980 680, 1100 880, 1400 760 L 1400 1400 L 0 1400 Z" fill="${hill2}"/>
    <path d="M0 1040 C 300 1000, 600 1080, 900 1020 C 1100 980, 1260 1040, 1400 1000 L 1400 1400 L 0 1400 Z" fill="url(#water)"/>
    <path d="M40 150 C 70 280, 40 420, 90 560" fill="none" stroke="#0B1020" stroke-width="18" stroke-linecap="round" opacity="0.55"/>
    <path d="M90 200 C 140 300, 100 420, 160 520" fill="none" stroke="#0B1020" stroke-width="10" stroke-linecap="round" opacity="0.4"/>
    `,
    W,
    H,
  );
}

async function photoPair(fileA, fileB, palette) {
  const base = landscape(palette);
  const rendered = await sharp(base).png().toBuffer();
  await sharp(rendered).extract({ left: 80, top: 60, width: 1100, height: 1100 }).jpeg({ quality: 88 }).toFile(join(PUBLIC, fileA));
  await sharp(rendered)
    .extract({ left: 150, top: 110, width: 1100, height: 1100 })
    .modulate({ brightness: 1.07, saturation: 0.94 })
    .jpeg({ quality: 86 })
    .toFile(join(PUBLIC, fileB));
}

function recording(title, lines, tint) {
  const rows = lines
    .map(
      (line, i) =>
        `<rect x="64" y="${230 + i * 118}" width="${line.w}" height="78" rx="22" fill="${line.color}"/>`,
    )
    .join('');
  return svg(
    `
    <rect width="1000" height="1000" fill="${tint}"/>
    <rect width="1000" height="96" fill="#FF3B30"/>
    <text x="56" y="64" font-family="Inter" font-size="40" font-weight="700" fill="#fff">9:41</text>
    <circle cx="910" cy="48" r="16" fill="#fff"/>
    <text x="64" y="180" font-family="Inter" font-size="52" font-weight="700" fill="#0B1020">${esc(title)}</text>
    ${rows}
    `,
    1000,
    1000,
  );
}

async function writeSamples() {
  rmSync(PUBLIC, { recursive: true, force: true });
  mkdirSync(PUBLIC, { recursive: true });
  await photoPair('dup-a.jpg', 'dup-b.jpg', {
    sky0: '#1E4F93',
    sky1: '#7EB6F0',
    sky2: '#F6E2B8',
    sun: '#FFE08A',
    hill: '#2F6B4F',
    hill2: '#1C3A32',
    water: '#3E7C9A',
  });
  await photoPair('dup-c.jpg', 'dup-d.jpg', {
    sky0: '#3A2A6A',
    sky1: '#E07A4A',
    sky2: '#F6C98A',
    sun: '#FFD0A0',
    hill: '#6A3A38',
    hill2: '#2A1C28',
    water: '#C46A4A',
  });
  await sharp(
    recording('Weekend notes', [
      { w: 760, color: '#FFFFFF' },
      { w: 820, color: '#E7ECF6' },
      { w: 640, color: '#FFFFFF' },
      { w: 860, color: '#E7ECF6' },
      { w: 520, color: '#FFFFFF' },
    ], '#EEF2FA'),
  )
    .jpeg({ quality: 90 })
    .toFile(join(PUBLIC, 'vid-rec-1.jpg'));
  await sharp(
    recording('Campus map', [
      { w: 872, color: '#D7E8D4' },
      { w: 872, color: '#C5DDF0' },
      { w: 520, color: '#F4E2B0' },
      { w: 700, color: '#FFFFFF' },
      { w: 400, color: '#E7ECF6' },
    ], '#E7F0E4'),
  )
    .jpeg({ quality: 90 })
    .toFile(join(PUBLIC, 'vid-rec-2.jpg'));
  const clip = landscape({
    sky0: '#12305A',
    sky1: '#3E8F8A',
    sky2: '#E7C98A',
    sun: '#FFF1C2',
    hill: '#245C48',
    hill2: '#14342C',
    water: '#1E6A78',
  });
  await sharp(clip).extract({ left: 120, top: 80, width: 1100, height: 1100 }).jpeg({ quality: 88 }).toFile(join(PUBLIC, 'vid-clip.jpg'));
  const night = svg(
    `
    <rect width="1100" height="1100" fill="#12182A"/>
    <circle cx="860" cy="220" r="70" fill="#F4E7C2" opacity="0.9"/>
    ${Array.from({ length: 18 }, (_, i) => {
      const x = 80 + (i % 6) * 170;
      const h = 180 + ((i * 47) % 320);
      return `<rect x="${x}" y="${1100 - h}" width="110" height="${h}" fill="${i % 2 ? '#243156' : '#1A2744'}"/>
        <rect x="${x + 18}" y="${1100 - h + 30}" width="22" height="16" fill="#F6D98A" opacity="0.85"/>
        <rect x="${x + 58}" y="${1100 - h + 70}" width="22" height="16" fill="#F6D98A" opacity="0.55"/>`;
    }).join('')}
    `,
    1100,
    1100,
  );
  await sharp(night).jpeg({ quality: 88 }).toFile(join(PUBLIC, 'vid-clip-2.jpg'));
}

function startExpo() {
  const child = spawn('npx', ['expo', 'start', '--web', '--port', String(PORT)], {
    cwd: ROOT,
    env: {
      ...process.env,
      EXPO_PUBLIC_SCREENSHOTS: '1',
      CI: '1',
      EXPO_NO_TELEMETRY: '1',
      BROWSER: 'none',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const log = [];
  const onData = (buf) => {
    const text = buf.toString();
    log.push(text);
    process.stdout.write(text);
  };
  child.stdout.on('data', onData);
  child.stderr.on('data', onData);
  child.log = () => log.join('').slice(-4000);
  return child;
}

async function waitForServer(child) {
  const deadline = Date.now() + 120000;
  while (Date.now() < deadline) {
    if (child.exitCode != null) throw new Error(`expo exited ${child.exitCode}\n${child.log()}`);
    try {
      const res = await fetch(BASE);
      if (res.status < 500) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error(`expo web did not start\n${child.log()}`);
}

async function setScroll(page, top) {
  const result = await page.evaluate((top) => {
    const marked = document.querySelector('[data-testid="home-scroll"]');
    let scroller = marked;
    while (scroller && scroller.scrollHeight <= scroller.clientHeight + 20) scroller = scroller.parentElement;
    if (!scroller) return 'no-scroller';
    scroller.scrollTop = top;
    return `ok ${Math.round(scroller.scrollTop)}`;
  }, top);
  console.log('scrollTop', top, result);
  await page.waitForTimeout(200);
}

async function scrollTo(page, label, offset) {
  const result = await page.evaluate(({ label, offset }) => {
    const marked = document.querySelector('[data-testid="home-scroll"]');
    let scroller = marked;
    while (scroller && scroller.scrollHeight <= scroller.clientHeight + 20) scroller = scroller.parentElement;
    if (!scroller) return 'no-scroller';
    const walker = document.createTreeWalker(scroller, NodeFilter.SHOW_TEXT);
    let node;
    let target = null;
    while ((node = walker.nextNode())) {
      if (node.textContent && node.textContent.trim().includes(label)) {
        target = node.parentElement;
        break;
      }
    }
    if (!target) return 'no-label';
    const y = target.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop;
    scroller.scrollTop = Math.max(0, y - offset);
    return `ok ${Math.round(scroller.scrollTop)}`;
  }, { label, offset });
  console.log('scroll', label, result);
  await page.waitForTimeout(250);
}

async function capture(page, shot) {
  const url = `${BASE}/?shot=${shot.id}`;
  console.log('\n→', url);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 });
  try {
    await page.waitForSelector(`[data-testid="shot-${shot.id}"]`, { timeout: 120000 });
    await page.waitForFunction((text) => document.body.innerText.includes(text), shot.ready, { timeout: 60000 });
    await page.waitForFunction(async () => {
      if (document.fonts) await document.fonts.ready;
      const imgs = [...document.querySelectorAll('img')];
      return imgs.every((img) => img.complete && img.naturalWidth > 0);
    });
    if (shot.scroll) await scrollTo(page, shot.scroll, shot.scrollOffset ?? 74);
    if (shot.scrollTop != null) await setScroll(page, shot.scrollTop);
    await page.waitForTimeout(shot.pause ?? (shot.id === 'home' ? 800 : 350));
    await page.evaluate(() => {
      for (const el of document.querySelectorAll('div, span')) {
        const text = el.textContent || '';
        if (!text.includes('Invalid DOM property')) continue;
        let node = el;
        for (let i = 0; i < 8 && node; i += 1) {
          const h = node.getBoundingClientRect().height;
          if (h >= 28 && h <= 120) {
            node.style.setProperty('display', 'none', 'important');
            break;
          }
          node = node.parentElement;
        }
      }
    });
  } catch (err) {
    await page.screenshot({ path: join(RAW, `${shot.file}-fail.png`) }).catch(() => {});
    console.log('visible text:\n', (await page.locator('body').innerText().catch(() => '')).slice(0, 1500));
    throw err;
  }
  const file = join(RAW, `${shot.file}.png`);
  await page.screenshot({ path: file, fullPage: false });
  const meta = await sharp(file).metadata();
  if (meta.width !== 1290 || meta.height !== 2796) {
    throw new Error(`${shot.file} captured at ${meta.width}x${meta.height}, expected 1290x2796`);
  }
  console.log('captured', shot.file, `${meta.width}x${meta.height}`);
  return file;
}

async function frame(src, caption, W, H, outPath) {
  const head = Math.round(W * 0.058);
  const kicker = Math.round(W * 0.026);
  const top = Math.round(H * 0.04);
  const textBottom = top + kicker + Math.round(kicker * 0.8) + head + Math.round(H * 0.018);
  const bottom = Math.round(H * 0.026);
  const aspect = 430 / 932;
  const maxW = Math.round(W * 0.9);
  let screenH = H - textBottom - bottom;
  let screenW = Math.round(screenH * aspect);
  const bezel = Math.max(10, Math.round(screenW * 0.022));
  if (screenW + bezel * 2 > maxW) {
    screenW = maxW - bezel * 2;
    screenH = Math.round(screenW / aspect);
  }
  const screenR = Math.round(screenW * 0.11);
  const outerW = screenW + bezel * 2;
  const outerH = screenH + bezel * 2;
  const left = Math.round((W - outerW) / 2);
  const topPhone = textBottom + Math.round((H - textBottom - bottom - outerH) / 2);

  const bg = svg(
    `
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#FFFFFF"/>
        <stop offset="1" stop-color="#F3F7FF"/>
      </linearGradient>
      <radialGradient id="glow" cx="50%" cy="46%" r="58%">
        <stop offset="0" stop-color="#2563EB" stop-opacity="0.13"/>
        <stop offset="1" stop-color="#2563EB" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="${W}" height="${H}" fill="url(#bg)"/>
    <rect width="${W}" height="${H}" fill="url(#glow)"/>
    <ellipse cx="${W * 0.12}" cy="${H * 0.06}" rx="${W * 0.42}" ry="${H * 0.1}" fill="#19E3B1" opacity="0.13"/>
    <text x="${W / 2}" y="${top + kicker}" text-anchor="middle" font-family="Inter" font-weight="700" font-size="${kicker}" letter-spacing="${Math.round(kicker * 0.22)}" fill="#2563EB">AI KLENZER</text>
    <text x="${W / 2}" y="${top + kicker + Math.round(kicker * 0.85) + head}" text-anchor="middle" font-family="Fraunces" font-weight="700" font-size="${head}" letter-spacing="-1" fill="#0B1020">${esc(caption)}</text>
    `,
    W,
    H,
  );

  const mask = svg(`<rect width="${screenW}" height="${screenH}" rx="${screenR}" fill="#fff"/>`, screenW, screenH);
  const screen = await sharp(src)
    .resize(screenW, screenH, { fit: 'fill' })
    .composite([{ input: mask, blend: 'dest-in' }])
    .png()
    .toBuffer();

  const shell = svg(
    `<rect x="1" y="1" width="${outerW - 2}" height="${outerH - 2}" rx="${screenR + bezel}" fill="#0B1020" stroke="#2C3548" stroke-width="2"/>`,
    outerW,
    outerH,
  );
  const shadow = await sharp(
    svg(
      `<rect x="${left}" y="${topPhone + Math.round(H * 0.012)}" width="${outerW}" height="${outerH}" rx="${screenR + bezel}" fill="#1E3A8A" opacity="0.28"/>`,
      W,
      H,
    ),
  )
    .blur(Math.max(8, Math.round(W * 0.012)))
    .png()
    .toBuffer();

  await sharp(bg)
    .composite([
      { input: shadow, left: 0, top: 0 },
      { input: shell, left, top: topPhone },
      { input: screen, left: left + bezel, top: topPhone + bezel },
    ])
    .png({ compressionLevel: 9 })
    .toFile(outPath);
}

function installCaptionFont() {
  const dir = join(process.env.HOME || '/tmp', '.local/share/fonts');
  mkdirSync(dir, { recursive: true });
  copyFileSync(join(ROOT, 'node_modules/@expo-google-fonts/fraunces/700Bold/Fraunces_700Bold.ttf'), join(dir, 'Fraunces-Bold.ttf'));
  try {
    execFileSync('fc-cache', ['-f', dir], { stdio: 'ignore' });
  } catch {
    /* caption falls back to the nearest serif */
  }
}

async function main() {
  installCaptionFont();
  await writeSamples();
  mkdirSync(RAW, { recursive: true });
  for (const exp of EXPORTS) mkdirSync(join(HERE, exp.dir), { recursive: true });

  const expo = startExpo();
  const stop = () => {
    try {
      expo.kill('SIGKILL');
    } catch {
      /* already exited */
    }
  };
  process.on('exit', stop);
  try {
    await waitForServer(expo);
    const browser = await chromium.launch({
      executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome',
      args: ['--disable-dev-shm-usage', '--hide-scrollbars', '--force-color-profile=srgb'],
    });
    const context = await browser.newContext({
      viewport: { width: 430, height: 932 },
      deviceScaleFactor: 3,
      locale: 'en-US',
      timezoneId: 'UTC',
      colorScheme: 'light',
    });
    const page = await context.newPage();
    page.on('pageerror', (err) => console.log('pageerror', err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') console.log('console', msg.text());
    });
    page.on('response', (res) => {
      if (res.status() >= 400) console.log('HTTP', res.status(), res.url());
    });

    const raws = [];
    for (const shot of SHOTS) raws.push({ shot, file: await capture(page, shot) });
    await browser.close();

    for (const { shot, file } of raws) {
      for (const exp of EXPORTS) {
        const out = join(HERE, exp.dir, `${shot.file}.png`);
        await frame(file, shot.caption, exp.w, exp.h, out);
        const meta = await sharp(out).metadata();
        console.log('framed', `${exp.w}x${exp.h}`, shot.file, `${meta.width}x${meta.height}`);
      }
    }
  } finally {
    stop();
    rmSync(PUBLIC, { recursive: true, force: true });
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
