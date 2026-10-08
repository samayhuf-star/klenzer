// Brand + motion concept board (presentation image) for Klenzer.
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
mkdirSync(join(root, 'store/graphics'), { recursive: true });

const MINT = '#2EE6B8';
const BLUE = '#2F6BFF';
const NAVY = '#0B1020';

// iOS-style squircle (superellipse) path for a 1024 box
function squircle(size = 1024, n = 4.6, steps = 160) {
  const r = size / 2;
  let d = '';
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    const c = Math.cos(t), s = Math.sin(t);
    const x = r + r * Math.sign(c) * Math.pow(Math.abs(c), 2 / n);
    const y = r + r * Math.sign(s) * Math.pow(Math.abs(s), 2 / n);
    d += (i === 0 ? 'M' : 'L') + x.toFixed(2) + ' ' + y.toFixed(2);
  }
  return d + 'Z';
}
const SQ = squircle();

const star = (cx, cy, r, fill, extra = '') => {
  const k = r * 0.2;
  return `<path ${extra} fill="${fill}" d="M${cx} ${cy - r} C${cx + k} ${cy - k} ${cx + k} ${cy - k} ${cx + r} ${cy} C${cx + k} ${cy + k} ${cx + k} ${cy + k} ${cx} ${cy + r} C${cx - k} ${cy + k} ${cx - k} ${cy + k} ${cx - r} ${cy} C${cx - k} ${cy - k} ${cx - k} ${cy - k} ${cx} ${cy - r}Z"/>`;
};

const W = 1740, H = 890;

const defs = `
<defs>
  <linearGradient id="board" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#F9FBFF"/><stop offset="1" stop-color="#EAF0FA"/></linearGradient>
  <linearGradient id="bg" x1="0.1" y1="0" x2="0.9" y2="1"><stop offset="0" stop-color="#3CF0C2"/><stop offset="0.55" stop-color="#2FA8F0"/><stop offset="1" stop-color="#2F5BFF"/></linearGradient>
  <radialGradient id="glow" cx="0.25" cy="0.12" r="0.75"><stop offset="0" stop-color="#fff" stop-opacity="0.60"/><stop offset="0.5" stop-color="#fff" stop-opacity="0.08"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
  <radialGradient id="deep" cx="0.75" cy="1.05" r="0.9"><stop offset="0" stop-color="#0A1F7A" stop-opacity="0.45"/><stop offset="1" stop-color="#0A1F7A" stop-opacity="0"/></radialGradient>
  <linearGradient id="rim" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0.85"/><stop offset="0.35" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#0A1F7A" stop-opacity="0.35"/></linearGradient>
  <linearGradient id="kfill" gradientUnits="userSpaceOnUse" x1="300" y1="260" x2="780" y2="780"><stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="#DDF2FF"/></linearGradient>
  <linearGradient id="mark" gradientUnits="userSpaceOnUse" x1="40" y1="30" x2="170" y2="170"><stop offset="0" stop-color="${MINT}"/><stop offset="1" stop-color="${BLUE}"/></linearGradient>
  <radialGradient id="screen" cx="0.5" cy="0.35" r="0.9"><stop offset="0" stop-color="#16306E"/><stop offset="0.55" stop-color="#0E1A3F"/><stop offset="1" stop-color="${NAVY}"/></radialGradient>
  <clipPath id="sq"><path d="${SQ}"/></clipPath>
  <filter id="kshadow" x="-30%" y="-30%" width="160%" height="170%">
    <feDropShadow dx="0" dy="26" stdDeviation="22" flood-color="#06217A" flood-opacity="0.38"/>
  </filter>
  <filter id="iconShadow" x="-30%" y="-30%" width="160%" height="170%">
    <feDropShadow dx="0" dy="46" stdDeviation="46" flood-color="#2F5BFF" flood-opacity="0.42"/>
    <feDropShadow dx="0" dy="12" stdDeviation="12" flood-color="#0A1F7A" flood-opacity="0.22"/>
  </filter>
  <filter id="cardShadow" x="-10%" y="-20%" width="120%" height="150%">
    <feDropShadow dx="0" dy="14" stdDeviation="16" flood-color="#2B3A6B" flood-opacity="0.10"/>
  </filter>
  <filter id="phoneShadow" x="-30%" y="-10%" width="160%" height="130%">
    <feDropShadow dx="0" dy="34" stdDeviation="30" flood-color="#1B2A59" flood-opacity="0.35"/>
  </filter>
  <filter id="soft" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="14"/></filter>
  <filter id="markShadow" x="-30%" y="-30%" width="160%" height="170%">
    <feDropShadow dx="0" dy="10" stdDeviation="8" flood-color="#2F5BFF" flood-opacity="0.30"/>
  </filter>

  <!-- 1024 app icon with soft 3D shading -->
  <g id="icon">
    <g filter="url(#iconShadow)"><path d="${SQ}" fill="url(#bg)"/></g>
    <g clip-path="url(#sq)">
      <path d="${SQ}" fill="url(#bg)"/>
      <rect width="1024" height="1024" fill="url(#deep)"/>
      <rect width="1024" height="1024" fill="url(#glow)"/>
      <ellipse cx="380" cy="120" rx="520" ry="210" fill="#fff" opacity="0.16" filter="url(#soft)"/>
    </g>
    <path d="${SQ}" fill="none" stroke="url(#rim)" stroke-width="7"/>
    <g filter="url(#kshadow)">
      <g stroke="url(#kfill)" stroke-width="112" stroke-linecap="round" stroke-linejoin="round" fill="none">
        <path d="M372 286 V752"/>
        <path d="M388 556 L600 360"/>
        <path d="M450 504 L664 752"/>
      </g>
      ${star(716, 300, 124, 'url(#kfill)')}
      ${star(822, 470, 40, 'url(#kfill)')}
    </g>
  </g>
</defs>`;

const useIcon = (x, y, size) => `<use href="#icon" transform="translate(${x} ${y}) scale(${size / 1024})"/>`;

// Mark variants on a 200x200 grid
const strokeAttrs = 'stroke="url(#mark)" stroke-width="34" stroke-linecap="round" stroke-linejoin="round" fill="none"';
const variants = [
  { n: '01', label: ['SEPARATE', 'STROKES'], body: `<g filter="url(#markShadow)"><g ${strokeAttrs}><path d="M52 42 V158"/><path d="M96 104 L140 60"/><path d="M104 120 L142 162"/></g></g>` },
  { n: '02', label: ['JOINED', 'K'], body: `<g filter="url(#markShadow)"><g ${strokeAttrs}><path d="M62 40 V160"/><path d="M64 112 L134 48"/><path d="M92 98 L138 162"/></g></g>` },
  { n: '03', label: ['SUBTLE', 'SPARKLE'], body: `<g filter="url(#markShadow)"><g ${strokeAttrs}><path d="M62 52 V160"/><path d="M64 118 L126 62"/><path d="M92 102 L138 162"/></g>${star(160, 38, 22, 'url(#mark)')}</g>` },
];

const cards = variants
  .map((v, i) => {
    const y = 125 + i * 205;
    return `
  <g filter="url(#cardShadow)"><rect x="1150" y="${y}" width="465" height="190" rx="38" fill="#FFFFFF" opacity="0.92"/></g>
  <g transform="translate(1196 ${y + 8}) scale(0.88)">${v.body}</g>
  <text x="1473" y="${y + 70}" font-family="Helvetica Neue, Helvetica, Arial" font-size="15" letter-spacing="2.4" fill="#8A93AD">${v.n}</text>
  <line x1="1505" y1="${y + 65}" x2="1548" y2="${y + 65}" stroke="#C7CFE3" stroke-width="1.6"/>
  <text x="1473" y="${y + 106}" font-family="Helvetica Neue, Helvetica, Arial" font-size="18" letter-spacing="4" fill="#2A3358" font-weight="500">${v.label[0]}</text>
  <text x="1473" y="${y + 136}" font-family="Helvetica Neue, Helvetica, Arial" font-size="18" letter-spacing="4" fill="#2A3358" font-weight="500">${v.label[1]}</text>`;
  })
  .join('');

const phone = `
  <g filter="url(#phoneShadow)">
    <rect x="760" y="93" width="316" height="650" rx="74" fill="#0A0D17"/>
  </g>
  <rect x="760" y="93" width="316" height="650" rx="74" fill="none" stroke="#3A4156" stroke-width="3"/>
  <rect x="772" y="105" width="292" height="626" rx="63" fill="url(#screen)"/>
  <rect x="868" y="116" width="100" height="30" rx="15" fill="#05070D"/>
  ${useIcon(868, 306, 100)}
  ${star(978, 322, 11, '#2EE6B8')}
  ${star(852, 404, 7, '#FFFFFF')}
  ${star(990, 392, 5, '#2EE6B8')}
  <text x="918" y="480" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-weight="700" font-size="46" letter-spacing="-1" fill="#FFFFFF">Klenzer</text>
  <text x="918" y="512" text-anchor="middle" font-family="Helvetica Neue, Helvetica, Arial" font-size="12.5" letter-spacing="0.4" fill="#9FB0E0">Clear the clutter. Keep the moments.</text>
  <rect x="888" y="708" width="60" height="5" rx="2.5" fill="#fff" opacity="0.5"/>`;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  ${defs}
  <rect width="${W}" height="${H}" fill="#FFFFFF"/>
  <clipPath id="boardClip"><rect x="60" y="15" width="1620" height="810" rx="64"/></clipPath>
  <rect x="60" y="15" width="1620" height="810" rx="64" fill="url(#board)"/>
  <g clip-path="url(#boardClip)"><circle cx="330" cy="430" r="330" fill="${MINT}" opacity="0.07"/><circle cx="1500" cy="130" r="300" fill="${BLUE}" opacity="0.06"/></g>

  <text x="870" y="62" text-anchor="middle" font-family="Helvetica Neue, Helvetica, Arial" font-size="23" letter-spacing="9" fill="#1B2347">KLENZER</text>
  <line x1="446" y1="54" x2="690" y2="54" stroke="#C3CBE0" stroke-width="1.5"/>
  <line x1="1050" y1="54" x2="1296" y2="54" stroke="#C3CBE0" stroke-width="1.5"/>

  ${useIcon(148, 143, 550)}
  ${phone}
  ${cards}

  <line x1="446" y1="787" x2="664" y2="787" stroke="#C3CBE0" stroke-width="1.5"/>
  <text x="870" y="793" text-anchor="middle" font-family="Helvetica Neue, Helvetica, Arial" font-size="14" letter-spacing="6" fill="#7B86A6">BRAND AND MOTION CONCEPT</text>
  <line x1="1078" y1="787" x2="1296" y2="787" stroke="#C3CBE0" stroke-width="1.5"/>
</svg>`;

const out = join(root, 'store/graphics/klenzer-brand-board.png');
await sharp(Buffer.from(svg), { density: 144 }).png().toFile(out);
console.log('wrote', out);
