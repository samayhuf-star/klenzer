// Generates every brand asset (icon, adaptive icon, splash, favicon, Play feature graphic) from one SVG mark.
import sharp from 'sharp';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = (p) => join(root, p);
mkdirSync(out('assets'), { recursive: true });
mkdirSync(out('store/graphics'), { recursive: true });

const MINT = '#19E3B1';
const BLUE = '#2F6BFF';

// 4-point sparkle centred at (cx, cy)
const sparkle = (cx, cy, r, fill) => {
  const k = r * 0.22;
  return `<path fill="${fill}" d="M${cx} ${cy - r} C${cx + k} ${cy - k} ${cx + k} ${cy - k} ${cx + r} ${cy} C${cx + k} ${cy + k} ${cx + k} ${cy + k} ${cx} ${cy + r} C${cx - k} ${cy + k} ${cx - k} ${cy + k} ${cx - r} ${cy} C${cx - k} ${cy - k} ${cx - k} ${cy - k} ${cx} ${cy - r}Z"/>`;
};

// The Klenzer mark: a rounded "K" whose upper arm ends in a sparkle. Drawn in a 1024 box.
const mark = ({ k = '#FFFFFF', spark = '#FFFFFF', shadow = true } = {}) => `
  <g ${shadow ? 'filter="url(#soft)"' : ''}>
    <g stroke="${k}" stroke-width="92" stroke-linecap="round" stroke-linejoin="round" fill="none">
      <path d="M380 292 V744"/>
      <path d="M392 548 L590 372"/>
      <path d="M452 500 L650 744"/>
    </g>
    ${sparkle(684, 318, 104, spark)}
    ${sparkle(782, 460, 34, spark)}
  </g>`;

const defs = `
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${MINT}"/><stop offset="1" stop-color="${BLUE}"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.28" cy="0.2" r="0.8">
      <stop offset="0" stop-color="#fff" stop-opacity="0.45"/><stop offset="1" stop-color="#fff" stop-opacity="0"/>
    </radialGradient>
    <filter id="soft" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="14" stdDeviation="16" flood-color="#0A1F5C" flood-opacity="0.28"/>
    </filter>
  </defs>`;

const wrap = (w, h, body) =>
  Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${defs}${body}</svg>`);

const scaled = (s, inner) => `<g transform="translate(${512 - 512 * s} ${512 - 512 * s}) scale(${s})">${inner}</g>`;

// iOS icon: full-bleed square, no alpha (Apple rounds the corners itself)
const icon = wrap(1024, 1024, `<rect width="1024" height="1024" fill="url(#bg)"/><rect width="1024" height="1024" fill="url(#glow)"/>${mark()}`);
await sharp(icon).flatten({ background: BLUE }).png().toFile(out('assets/icon.png'));

// Android adaptive: foreground keeps the mark inside the 66% safe zone
await sharp(wrap(1024, 1024, scaled(0.8, mark()))).png().toFile(out('assets/android-icon-foreground.png'));
await sharp(wrap(1024, 1024, `<rect width="1024" height="1024" fill="url(#bg)"/><rect width="1024" height="1024" fill="url(#glow)"/>`)).png().toFile(out('assets/android-icon-background.png'));
await sharp(wrap(1024, 1024, scaled(0.8, mark({ k: '#000', spark: '#000', shadow: false })))).png().toFile(out('assets/android-icon-monochrome.png'));

// Splash + in-app logo (transparent background)
await sharp(wrap(1024, 1024, mark())).png().toFile(out('assets/splash-icon.png'));
await sharp(wrap(1024, 1024, `<rect x="40" y="40" width="944" height="944" rx="220" fill="url(#bg)"/><rect x="40" y="40" width="944" height="944" rx="220" fill="url(#glow)"/>${mark()}`)).png().toFile(out('assets/logo.png'));
await sharp(icon).resize(196, 196).png().toFile(out('assets/favicon.png'));

// Google Play feature graphic 1024x500
const feature = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="500" viewBox="0 0 1024 500">${defs}
  <rect width="1024" height="500" fill="#0B1020"/>
  <circle cx="900" cy="60" r="320" fill="${BLUE}" opacity="0.28"/>
  <circle cx="120" cy="520" r="300" fill="${MINT}" opacity="0.20"/>
  <g transform="translate(60 118) scale(0.26)"><rect x="40" y="40" width="944" height="944" rx="220" fill="url(#bg)"/>${mark()}</g>
  <text x="372" y="250" font-family="Helvetica, Arial, sans-serif" font-weight="800" font-size="104" fill="#fff" letter-spacing="-3">Klenzer</text>
  <text x="374" y="318" font-family="Helvetica, Arial, sans-serif" font-weight="500" font-size="40" fill="#BFD0FF">Clean photo &amp; video clutter.</text>
  <text x="374" y="368" font-family="Helvetica, Arial, sans-serif" font-weight="500" font-size="40" fill="#19E3B1">Private. On-device. You decide.</text>
</svg>`);
await sharp(feature).png().toFile(out('store/graphics/play-feature-graphic-1024x500.png'));

// Play Store hi-res icon 512 (has alpha allowed; use full-bleed)
await sharp(icon).resize(512, 512).png().toFile(out('store/graphics/play-icon-512.png'));
writeFileSync(out('store/graphics/.generated'), new Date().toISOString());
console.log('assets generated');
