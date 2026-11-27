// Framed, captioned 1290x2796 App Store screenshots. Usage: node frame.js config.json
const sharp = require('sharp');
const cfg = require(require('path').resolve(process.argv[2]));
const W = 1290, H = 2796, SW = 900, SH = 1950, BZ = 24, PX = (W - SW) / 2, PY = 700, R = 64;
const F = "font-family='DejaVu Sans'";
const esc = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const T = (y, s, t, c, w) => `<text x='${W / 2}' y='${y}' fill='${c}' font-size='${s}' font-weight='${w}' text-anchor='middle' ${F}>${esc(t)}</text>`;
const fit = (t, max) => Math.min(max, Math.floor(1180 / (t.length * 0.6)));

(async () => {
  const [c1, c2] = cfg.bg;
  const bg = Buffer.from(`<svg xmlns='http://www.w3.org/2000/svg' width='${W}' height='${H}'><defs>
    <linearGradient id='g' x1='0' y1='0' x2='0.35' y2='1'><stop offset='0' stop-color='${c1}'/><stop offset='1' stop-color='${c2}'/></linearGradient>
    <radialGradient id='r' cx='50%' cy='12%' r='60%'><stop offset='0' stop-color='#ffffff' stop-opacity='0.16'/><stop offset='1' stop-color='#ffffff' stop-opacity='0'/></radialGradient></defs>
    <rect width='${W}' height='${H}' fill='url(#g)'/><rect width='${W}' height='${H}' fill='url(#r)'/></svg>`);
  let n = 0;
  for (const s of cfg.shots) {
    n++;
    let img = sharp(s.src);
    if (s.crop) img = sharp(await img.extract(s.crop).png().toBuffer());
    const screen = await img.resize(SW, SH, { fit: 'cover', position: 'top' })
      .composite([{ input: Buffer.from(`<svg xmlns='http://www.w3.org/2000/svg' width='${SW}' height='${SH}'><rect width='${SW}' height='${SH}' rx='${R}'/></svg>`), blend: 'dest-in' }])
      .png().toBuffer();
    const s1 = fit(s.cap[0], 96), s2 = fit(s.cap[1], 96), sz = Math.min(s1, s2);
    const over = Buffer.from(`<svg xmlns='http://www.w3.org/2000/svg' width='${W}' height='${H}'>
      <rect x='${PX - BZ + 10}' y='${PY - BZ + 26}' width='${SW + 2 * BZ}' height='${SH + 2 * BZ}' rx='${R + BZ}' fill='#000' opacity='0.28'/>
      <rect x='${PX - BZ}' y='${PY - BZ}' width='${SW + 2 * BZ}' height='${SH + 2 * BZ}' rx='${R + BZ}' fill='#0b0d14' stroke='${cfg.bezel || '#3a4566'}' stroke-width='5'/>
      ${T(250, sz, s.cap[0], cfg.ink || '#ffffff', 800)}${T(250 + sz * 1.18, sz, s.cap[1], cfg.accent, 800)}${T(250 + sz * 1.18 + 104, 46, s.sub, cfg.sub || '#e6ebf5', 400)}</svg>`);
    const f = `${cfg.out}/${cfg.prefix}-${String(n).padStart(2, '0')}.png`;
    await sharp(bg).composite([{ input: over }, { input: screen, left: PX, top: PY }]).flatten({ background: c2 }).removeAlpha().png({ compressionLevel: 9 }).toFile(f);
    console.log(f);
  }
})();
