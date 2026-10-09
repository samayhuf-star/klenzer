// Turns REAL simulator screenshots into store-ready marketing frames.
// usage: node frame-screenshots.mjs <input-dir> <output-dir>
// Inputs (any that exist): ios-1-home.png, ios-2-duplicates.png, ios-3-screenshots.png, ios-4-videos.png, ios-5-done.png
// Outputs: <out>/appstore/*.png (1290x2796, App Store 6.7"/6.9" class) and <out>/play/*.png (1080x1920, 9:16)
import sharp from 'sharp';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const [inDir, outDir] = process.argv.slice(2);
if (!inDir || !outDir) {
  console.error('usage: node frame-screenshots.mjs <input-dir> <output-dir>');
  process.exit(1);
}

const SHOTS = [
  { file: 'ios-1-home.png', head: 'See what’s taking space', sub: 'Real storage numbers, scanned on your device' },
  { file: 'ios-2-duplicates.png', head: 'Find duplicates in seconds', sub: 'We keep the best copy. You choose the rest.' },
  { file: 'ios-3-screenshots.png', head: 'Clear old screenshots', sub: 'Biggest first. Tap to select, one tap to clear.' },
  { file: 'ios-4-videos.png', head: 'Spot the huge videos', sub: 'Reclaim gigabytes in a few taps' },
  { file: 'ios-5-done.png', head: 'Done. You stay in control.', sub: 'Nothing is deleted without your OK' },
];

const esc = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;');

async function frame(src, shot, W, H, outPath) {
  const headSize = Math.round(W * 0.062);
  const subSize = Math.round(W * 0.031);
  const top = Math.round(H * 0.045);
  const textBlock = Math.round(headSize * 1.2 + subSize * 1.9);
  const phoneTop = top + textBlock + Math.round(H * 0.03);
  const phoneH = H - phoneTop - Math.round(H * 0.03);
  const meta = await sharp(src).metadata();
  const phoneW = Math.round((phoneH * meta.width) / meta.height);
  const radius = Math.round(phoneW * 0.115);
  const px = Math.round((W - phoneW) / 2);

  const bg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#19E3B1"/><stop offset="0.55" stop-color="#2F8CF0"/><stop offset="1" stop-color="#2F5BFF"/></linearGradient>
      <radialGradient id="h" cx="0.2" cy="0.05" r="0.9"><stop offset="0" stop-color="#fff" stop-opacity="0.45"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
    </defs>
    <rect width="${W}" height="${H}" fill="url(#g)"/><rect width="${W}" height="${H}" fill="url(#h)"/>
    <text x="${W / 2}" y="${top + headSize}" text-anchor="middle" font-family="Helvetica Neue, Helvetica, Arial" font-weight="800" font-size="${headSize}" letter-spacing="-1" fill="#fff">${esc(shot.head)}</text>
    <text x="${W / 2}" y="${top + headSize + Math.round(subSize * 1.75)}" text-anchor="middle" font-family="Helvetica Neue, Helvetica, Arial" font-weight="500" font-size="${subSize}" fill="#E8F6FF" fill-opacity="0.92">${esc(shot.sub)}</text>
  </svg>`);

  const mask = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${phoneW}" height="${phoneH}"><rect width="${phoneW}" height="${phoneH}" rx="${radius}" fill="#fff"/></svg>`);
  const phone = await sharp(src)
    .resize(phoneW, phoneH, { fit: 'cover' })
    .composite([{ input: mask, blend: 'dest-in' }])
    .png()
    .toBuffer();
  const bezel = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${phoneW + 24}" height="${phoneH + 24}"><rect x="2" y="2" width="${phoneW + 20}" height="${phoneH + 20}" rx="${radius + 10}" fill="#0A0D17" stroke="#3A4156" stroke-width="3"/></svg>`);
  const shadow = await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect x="${px - 12}" y="${phoneTop + 28}" width="${phoneW + 24}" height="${phoneH + 24}" rx="${radius + 10}" fill="#0A1F7A" opacity="0.5"/></svg>`))
    .blur(Math.round(W * 0.02))
    .png()
    .toBuffer();

  await sharp(bg)
    .composite([
      { input: shadow, left: 0, top: 0 },
      { input: bezel, left: px - 12, top: phoneTop - 12 },
      { input: phone, left: px, top: phoneTop },
    ])
    .png()
    .toFile(outPath);
}

mkdirSync(join(outDir, 'appstore'), { recursive: true });
mkdirSync(join(outDir, 'play'), { recursive: true });
let n = 0;
for (const shot of SHOTS) {
  const src = join(inDir, shot.file);
  if (!existsSync(src)) {
    console.log('skip (missing):', shot.file);
    continue;
  }
  n++;
  const base = shot.file.replace(/^ios-/, '').replace(/\.png$/, '');
  await frame(src, shot, 1290, 2796, join(outDir, 'appstore', `${String(n).padStart(2, '0')}-${base}.png`));
  await frame(src, shot, 1080, 1920, join(outDir, 'play', `${String(n).padStart(2, '0')}-${base}.png`));
  console.log('framed:', shot.file);
}
console.log(`done: ${n} screenshot(s) -> ${outDir}`);
