// Klenzer screen recreations, built from src/theme.ts and the app's screen code.
// Every screen is drawn at iPhone 17 Pro Max logical size (440 x 956 pt).
const C = {
  bg: '#F6F8FC', card: '#FFFFFF', ink: '#0B1020', ink2: '#4A5470', ink3: '#8A93AD', line: '#E4E9F4',
  mint: '#19E3B1', blue: '#2F6BFF', blueSoft: '#E7EEFF', mintSoft: '#DDFBF2', danger: '#F2455C', dangerSoft: '#FFE9EC',
  amber: '#FF9F1C', amberSoft: '#FFF1DB', violet: '#7A5CFF', violetSoft: '#EEEAFF', navy: '#0B1020',
};
const KINDS = {
  duplicates: { title: 'Duplicates & near-identical', icon: 'copy', tone: C.blue, soft: C.blueSoft },
  screenshots: { title: 'Screenshots', icon: 'phone-portrait', tone: C.violet, soft: C.violetSoft },
  videos: { title: 'Large videos', icon: 'videocam', tone: C.amber, soft: C.amberSoft },
  live: { title: 'Live Photos', icon: 'aperture', tone: '#0BAE86', soft: C.mintSoft },
  temp: { title: 'Temporary files', icon: 'folder-open', tone: C.danger, soft: C.dangerSoft },
};

let GLYPHS = {};
const icon = (name, size, color, extra = '') =>
  `<i class="ion" style="font-size:${size}px;color:${color};${extra}">${String.fromCodePoint(GLYPHS[name])}</i>`;

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const ease = (t) => 1 - Math.pow(1 - clamp(t), 3);
const fmtGB = (b) => {
  if (b <= 0) return '0 MB';
  const gb = b / 1e9;
  if (gb >= 1) return `${gb.toFixed(1)} GB`;
  return `${Math.round(b / 1e6)} MB`;
};
const n = (x) => Math.round(x).toLocaleString('en-US');

// ---------- the realistic, internally consistent library used everywhere ----------
const LIB = {
  total: 255.4e9, free: 24.6e9,
  photos: 27310, videos: 1234,
  dup: { count: 412, bytes: 3.1e9 },
  shots: { count: 1286, bytes: 1.2e9 },
  vids: { count: 23, bytes: 6.4e9 },
  live: { count: 2940, bytes: 5.7e9 },
  temp: { bytes: 186e6 },
  lifetimeFreed: 12.8e9, lifetimeItems: 3904,
};

// ---------- procedural "photos" (so no one's real pictures are shown) ----------
function rng(seed) { let s = seed * 9301 + 49297; return () => ((s = (s * 9301 + 49297) % 233280) / 233280); }
function photo(scene, v = 0) {
  const r = rng(scene * 31 + 3);
  const dx = v * 2.2, br = 1 - v * 0.04;
  const id = `g${scene}_${v}_${(photo.k = (photo.k || 0) + 1)}`;
  const S = (inner, defs = '') =>
    `<svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" style="filter:brightness(${br})"><defs>${defs}</defs><g transform="translate(${-dx} 0) scale(${1 + v * 0.03})">${inner}</g></svg>`;
  switch (scene % 8) {
    case 0: // sunset over sea
      return S(`<rect width="110" height="100" fill="url(#${id})"/><circle cx="62" cy="55" r="13" fill="#FFE08A"/><rect y="58" width="110" height="42" fill="#3B3F86"/><rect y="58" width="110" height="42" fill="url(#${id}w)" opacity=".7"/><path d="M0 62 L22 48 L40 60 L58 50 L80 62 L110 52 L110 64 L0 64Z" fill="#2A2A5E"/>`,
        `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FF7A59"/><stop offset=".6" stop-color="#FFB86B"/><stop offset="1" stop-color="#FFD9A0"/></linearGradient><linearGradient id="${id}w" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FF9E7A"/><stop offset="1" stop-color="#1D2350"/></linearGradient>`);
    case 1: // snowy mountains
      return S(`<rect width="110" height="100" fill="url(#${id})"/><path d="M-5 80 L28 30 L45 55 L62 22 L105 80Z" fill="#5C6FA8"/><path d="M28 30 L35 41 L30 39 L24 44Z M62 22 L72 37 L66 34 L58 38Z" fill="#fff"/><path d="M-5 100 L-5 72 L30 62 L60 74 L110 60 L110 100Z" fill="#2E7D5B"/><path d="M-5 100 L-5 84 L50 78 L110 86 L110 100Z" fill="#1F5E44"/>`,
        `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5DA9FF"/><stop offset="1" stop-color="#CFE6FF"/></linearGradient>`);
    case 2: // city at night
      { let b = ''; let x = -4; while (x < 108) { const w = 9 + r() * 9, h = 30 + r() * 45; b += `<rect x="${x}" y="${100 - h}" width="${w}" height="${h}" fill="#1B2348"/>`; for (let yy = 100 - h + 4; yy < 96; yy += 6) for (let xx = x + 2; xx < x + w - 2; xx += 4) if (r() > 0.45) b += `<rect x="${xx}" y="${yy}" width="2" height="2.6" fill="#FFD37A"/>`; x += w + 1.5; }
        return S(`<rect width="110" height="100" fill="url(#${id})"/><circle cx="78" cy="18" r="6" fill="#F4F1D0"/>${b}`, `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0E1435"/><stop offset="1" stop-color="#3B3F86"/></linearGradient>`); }
    case 3: // bokeh flowers
      { let c = ''; for (let i = 0; i < 14; i++) c += `<circle cx="${r() * 100}" cy="${r() * 100}" r="${4 + r() * 12}" fill="${['#FF7EB3', '#FFD166', '#7CF2C8', '#FFFFFF'][i % 4]}" opacity="${0.25 + r() * 0.5}"/>`;
        return S(`<rect width="110" height="100" fill="#1E4D3A"/>${c}<circle cx="50" cy="56" r="14" fill="#FF5C8A"/><circle cx="50" cy="56" r="5" fill="#FFD166"/>`); }
    case 4: // beach
      return S(`<rect width="110" height="100" fill="#8FD3FF"/><rect y="50" width="110" height="18" fill="#1BA7C9"/><rect y="56" width="110" height="4" fill="#7FE0EE" opacity=".6"/><path d="M-5 100 L-5 66 Q50 60 110 70 L110 100Z" fill="#F4DDA8"/><circle cx="20" cy="22" r="8" fill="#FFF6C2"/><path d="M80 70 Q78 50 74 40" stroke="#6B4A2B" stroke-width="2" fill="none"/><path d="M74 40 q-10 -2 -16 4 M74 40 q8 -6 16 -2 M74 40 q-2 -8 -10 -10 M74 40 q6 0 10 8" stroke="#2E8B57" stroke-width="3" fill="none" stroke-linecap="round"/>`);
    case 5: // food
      return S(`<rect width="110" height="100" fill="#B07A4F"/><rect width="110" height="100" fill="url(#${id})" opacity=".35"/><circle cx="50" cy="52" r="34" fill="#F7F3EE"/><circle cx="50" cy="52" r="26" fill="#E9B44C"/><circle cx="42" cy="46" r="6" fill="#D1495B"/><circle cx="58" cy="50" r="5" fill="#D1495B"/><circle cx="48" cy="60" r="5" fill="#D1495B"/><circle cx="56" cy="40" r="3" fill="#4CAF50"/><circle cx="40" cy="58" r="3" fill="#4CAF50"/>`,
        `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#000"/><stop offset=".5" stop-color="#fff"/><stop offset="1" stop-color="#000"/></linearGradient>`);
    case 6: // lake & forest
      return S(`<rect width="110" height="100" fill="#FDE2C4"/><path d="M-5 58 L10 30 L20 58 L30 26 L42 58 L52 34 L64 58 L76 28 L88 58 L98 36 L110 58Z" fill="#245A4A"/><rect y="58" width="110" height="42" fill="#6FA8C9"/><path d="M-5 58 L10 84 L20 58 L30 90 L42 58 L52 80 L64 58 L76 88 L88 58 L98 78 L110 58Z" fill="#245A4A" opacity=".35"/>`);
    default: // desert dunes
      return S(`<rect width="110" height="100" fill="#FFC48C"/><circle cx="74" cy="28" r="10" fill="#FFF0C9"/><path d="M-5 70 Q30 45 60 66 T110 58 L110 100 L-5 100Z" fill="#E08A4F"/><path d="M-5 84 Q40 64 80 84 T110 80 L110 100 L-5 100Z" fill="#C46A3A"/>`);
  }
}
function fakeShot(k) {
  const t = k % 4;
  const inner = [
    `<rect width="100" height="100" fill="#fff"/><rect x="8" y="12" width="52" height="12" rx="6" fill="#E9ECF3"/><rect x="40" y="30" width="52" height="12" rx="6" fill="#2F6BFF"/><rect x="8" y="48" width="40" height="12" rx="6" fill="#E9ECF3"/><rect x="34" y="66" width="58" height="12" rx="6" fill="#2F6BFF"/><rect x="8" y="84" width="30" height="10" rx="5" fill="#E9ECF3"/>`,
    `<rect width="100" height="100" fill="#E7F0E3"/><path d="M0 30 L100 50 M30 0 L50 100 M0 80 L100 70" stroke="#fff" stroke-width="6"/><path d="M0 30 L100 50" stroke="#FFD166" stroke-width="3"/><circle cx="52" cy="46" r="6" fill="#F2455C"/><rect x="8" y="80" width="84" height="14" rx="5" fill="#fff"/>`,
    `<rect width="100" height="100" fill="#fff"/><rect x="10" y="8" width="40" height="7" rx="2" fill="#0B1020"/>${[24, 36, 48, 60].map((y) => `<rect x="10" y="${y}" width="50" height="5" rx="2" fill="#C9D0DE"/><rect x="74" y="${y}" width="16" height="5" rx="2" fill="#8A93AD"/>`).join('')}<rect x="10" y="76" width="80" height="12" rx="6" fill="#19E3B1"/>`,
    `<rect width="100" height="100" fill="#0B1020"/><rect x="0" y="16" width="100" height="56" fill="#7A5CFF"/><circle cx="50" cy="44" r="14" fill="#FF7EB3"/><rect x="8" y="78" width="50" height="5" rx="2" fill="#fff"/><rect x="8" y="87" width="34" height="4" rx="2" fill="#8A93AD"/>`,
  ][t];
  return `<svg viewBox="0 0 100 100" preserveAspectRatio="none">${inner}</svg>`;
}

// ---------- shared chrome ----------
function statusBar(dark) {
  const c = dark ? '#fff' : C.ink;
  return `<div class="sb" style="color:${c}"><span>9:41</span><span class="sbr">${icon('cellular', 17, c)}${icon('wifi', 17, c)}${icon('battery-full', 25, c)}</span></div>`;
}
function btn(label, variant = 'primary', ic = '', extra = '') {
  const bg = variant === 'primary' ? `background:linear-gradient(135deg,${C.blue},#1BB6D8)` : variant === 'danger' ? `background:${C.danger}` : variant === 'light' ? 'background:#fff' : `background:${C.blueSoft}`;
  const col = variant === 'primary' || variant === 'danger' ? '#fff' : variant === 'light' ? C.ink : C.blue;
  return `<div class="btn" style="${bg};color:${col};${extra}">${ic}<span>${label}</span></div>`;
}
function ring(size, stroke, p, inner) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  return `<div style="position:relative;width:${size}px;height:${size}px"><svg width="${size}" height="${size}" style="position:absolute;inset:0"><defs><linearGradient id="ringg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${C.mint}"/><stop offset="1" stop-color="${C.blue}"/></linearGradient></defs><circle cx="${size / 2}" cy="${size / 2}" r="${r}" stroke="${C.line}" stroke-width="${stroke}" fill="none"/><circle cx="${size / 2}" cy="${size / 2}" r="${r}" stroke="url(#ringg)" stroke-width="${stroke}" fill="none" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - p)}" transform="rotate(-90 ${size / 2} ${size / 2})"/></svg><div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center">${inner}</div></div>`;
}

// ---------- Home ----------
// s: { freeShown, ringP, scanning:{done,total,phase}|null, results:0..1 (stagger), lifetime:bool, tap:0..1 }
function home(s = {}) {
  const free = s.freeShown ?? LIB.free;
  const ringP = s.ringP ?? (LIB.total - LIB.free) / LIB.total;
  const cats = [
    ['duplicates', LIB.dup.count, LIB.dup.bytes, 'Photos taken at the same moment, same size'],
    ['screenshots', LIB.shots.count, LIB.shots.bytes, 'Review and clear the ones you don’t need'],
    ['videos', LIB.vids.count, LIB.vids.bytes, 'Videos over 100 MB, biggest first'],
    ['live', LIB.live.count, LIB.live.bytes, 'Photos that also store a short video clip'],
    ['temp', 1, LIB.temp.bytes, 'Klenzer’s own cache. Other apps’ data can’t be touched'],
  ];
  const res = s.results ?? 1;
  let body = '';
  if (s.scanning) {
    const p = s.scanning.total ? s.scanning.done / s.scanning.total : 0;
    body = `<div class="card" style="margin-top:16px;padding:20px">
      <div style="display:flex;justify-content:center;margin-bottom:6px">${pulse(110, s.pulseT ?? 0)}</div>
      <div class="cardTitle" style="text-align:center">${s.scanning.phase === 'measuring' ? 'Measuring file sizes' : 'Reading your library'}…</div>
      <div class="bar"><div class="barFill" style="width:${Math.max(4, p * 100)}%"></div></div>
      <div class="sub" style="text-align:left">${n(s.scanning.done)} of ${n(s.scanning.total)} · ${Math.round(p * 100)}%</div>
      ${btn('Cancel', 'ghost', '', 'margin-top:14px')}</div>`;
  } else {
    body = `<div style="margin-top:18px;position:relative">${btn(res > 0 ? 'Scan again' : 'Scan my library', 'primary', icon('sparkles', 20, '#fff'))}${s.tap ? tapRipple(s.tap) : ''}</div>`;
    if (res > 0) {
      body += `<div style="margin-top:22px;display:flex;flex-direction:column;gap:12px">
        <div class="section" style="opacity:${ease(res * 5)}">What we found</div>
        ${cats.map(([k, cnt, b, hint], i) => {
          const a = ease(res * 5 - i * 0.6 - 0.3);
          const K = KINDS[k];
          const cc = Math.round(cnt * a), bb = b * a;
          return `<div class="card cat" style="opacity:${a};transform:translateY(${(1 - a) * 24}px)">
            <div class="catIcon" style="background:${K.soft}">${icon(K.icon, 24, K.tone)}</div>
            <div style="flex:1;min-width:0"><div class="catTitle">${K.title}</div><div class="catHint">${hint}</div></div>
            <div style="text-align:right"><div class="catBytes">${fmtGB(bb)}</div><div class="catCount">${k === 'temp' ? 'tap to clear' : `${n(cc)} items`}</div></div>
            ${icon('chevron-forward', 18, C.ink3)}</div>`;
        }).join('')}
        <div style="opacity:${ease(res * 5 - 3.4)}">${btn('Quick clean: duplicates + temporary files', 'primary', icon('flash', 20, '#fff'), 'margin-top:6px')}</div>
        <div class="foot" style="opacity:${ease(res * 5 - 3.6)}">Scanned ${n(LIB.photos)} photos and ${n(LIB.videos)} videos. Photos stored only in iCloud aren’t measured.</div>
      </div>`;
    }
  }
  const life = s.lifetime === false ? '' : `<div class="life">${icon('leaf', 18, C.mint)}<span>You’ve freed <b>${fmtGB(LIB.lifetimeFreed)}</b> · ${n(LIB.lifetimeItems)} items removed</span></div>`;
  return `<div class="scr" style="background:${C.bg}">${statusBar()}
    <div class="scroll" style="transform:translateY(${-(s.scrollY ?? 0)}px)">
    <div class="hdr"><div class="brand"><img src="logo.png" style="width:34px;height:34px;border-radius:9px"/><span class="brandText">Klenzer</span></div><div class="gear">${icon('settings-outline', 22, C.ink)}</div></div>
    <div class="card hero"><div class="eyebrow">THIS DEVICE</div>${ring(188, 16, ringP, `<div class="big">${fmtGB(free)}</div><div class="sub">free of ${(LIB.total / 1e9).toFixed(1)} GB</div>`)}
      <div class="note">Klenzer clears photo and video clutter, which is often the biggest space hog. It can’t clear app caches or system data.</div></div>
    ${body}${life}</div></div>`;
}
function pulse(size, t, ic = 'sparkles', color = C.blue) {
  const rings = [0, 1, 2].map((i) => { const p = ((t * 0.8 + i / 3) % 1); return `<div style="position:absolute;inset:0;border-radius:50%;border:2px solid ${color};opacity:${(1 - p) * 0.45};transform:scale(${0.55 + p * 0.5})"></div>`; }).join('');
  return `<div style="position:relative;width:${size}px;height:${size}px">${rings}<div style="position:absolute;inset:${size * 0.22}px;border-radius:50%;background:#fff;border:2px solid ${color}55;display:flex;align-items:center;justify-content:center;box-shadow:0 6px 18px ${color}33">${icon(ic, size * 0.3, color)}</div></div>`;
}
function tapRipple(p) {
  return `<div style="position:absolute;left:50%;top:50%;width:60px;height:60px;margin:-30px;border-radius:50%;background:rgba(255,255,255,.55);transform:scale(${0.3 + p * 2.2});opacity:${1 - p}"></div>`;
}

// ---------- Review screens ----------
function reviewTop(title) {
  return `<div class="rtop"><div class="back">${icon('chevron-back', 24, C.ink)}</div><div class="rtitle">${title}</div><div style="width:44px"></div></div>`;
}
function thumb(inner, size, selected, badge, meta) {
  return `<div class="thumb" style="width:${size}px;height:${size}px">${inner}
    ${selected ? '<div style="position:absolute;inset:0;background:rgba(47,107,255,0.28)"></div>' : ''}
    <div class="check" style="${selected ? `background:${C.blue};border-color:${C.blue}` : ''}">${selected ? icon('checkmark', 14, '#fff') : ''}</div>
    ${badge ? `<div class="badge">${badge}</div>` : ''}${meta ? `<div class="meta">${meta}</div>` : ''}</div>`;
}
function reviewBar(label, note, disabled) {
  return `<div class="rbar">${btn(label, 'danger', icon('trash', 19, '#fff'), disabled ? 'opacity:.5' : '')}<div class="barNote">${note}</div></div>`;
}
const IOS_NOTE = 'Your iPhone will ask you to confirm. Items go to Recently Deleted; Klenzer will take you to Photos to empty it.';

// selP: 0..1 how far the "pre-select extras" animation has gone
function duplicates(s = {}) {
  const selP = s.selP ?? 1;
  const groups = [
    { date: 'Oct 12, 2026', scene: 0, k: 3, sizes: ['4.1 MB', '3.9 MB', '3.8 MB'] },
    { date: 'Oct 4, 2026', scene: 3, k: 2, sizes: ['5.2 MB', '5.0 MB'] },
    { date: 'Sep 28, 2026', scene: 1, k: 3, sizes: ['6.3 MB', '6.1 MB', '6.0 MB'] },
    { date: 'Sep 21, 2026', scene: 5, k: 2, sizes: ['3.4 MB', '3.3 MB'] },
  ];
  const cell = (440 - 40 - 32 - 12) / 3;
  let idx = 0;
  const html = groups.map((g) => `<div class="group"><div class="groupMeta">${g.date} · ${g.k} similar</div><div style="display:flex;gap:6px">${Array.from({ length: g.k }, (_, i) => {
    const sel = i > 0 && selP * 8 > idx++;
    return thumb(photo(g.scene, i), cell, sel, i === 0 ? 'Best' : '', g.sizes[i]);
  }).join('')}</div></div>`).join('');
  const shown = selP >= 1 ? `Delete ${n(LIB.dup.count)} · ${fmtGB(LIB.dup.bytes)}` : `Delete ${n(Math.round(LIB.dup.count * selP))} · ${fmtGB(LIB.dup.bytes * selP)}`;
  return `<div class="scr" style="background:${C.bg}">${statusBar()}${reviewTop('Duplicates & near-identical')}
    <div class="rbody" style="transform:translateY(${-(s.scrollY ?? 0)}px)"><div class="help">Photos taken at the same moment with the same dimensions. We keep the largest file in each set; tap any photo to change what’s selected.</div>
    <div style="display:flex;flex-direction:column;gap:12px;margin-top:14px">${html}</div></div>
    ${selP <= 0 ? reviewBar('Select items to delete', IOS_NOTE, true) : reviewBar(shown, IOS_NOTE)}${s.tap ? `<div style="position:absolute;left:220px;bottom:96px">${tapRipple(s.tap)}</div>` : ''}</div>`;
}
function screenshots(s = {}) {
  const cell = (440 - 40 - 12) / 3;
  const sel = new Set([0, 1, 3, 4, 6, 9, 10, 11, 13]);
  const sizes = ['3.2 MB', '2.9 MB', '2.7 MB', '2.6 MB', '2.4 MB', '2.2 MB', '2.1 MB', '1.9 MB', '1.8 MB', '1.7 MB', '1.6 MB', '1.6 MB', '1.5 MB', '1.4 MB', '1.3 MB'];
  const grid = sizes.map((sz, i) => thumb(fakeShot(i), cell, sel.has(i), '', sz)).join('');
  return `<div class="scr" style="background:${C.bg}">${statusBar()}${reviewTop('Screenshots')}
    <div class="rbody"><div class="help">Nothing is selected by default. Tap the ones you want to clear.</div>
    <div class="selAll">Select all ${n(LIB.shots.count)}</div>
    <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:14px">${grid}</div></div>
    ${reviewBar('Delete 9 · 20 MB', IOS_NOTE)}</div>`;
}
function videos(s = {}) {
  const cell = (440 - 40 - 12) / 3;
  const v = [['2:41', '1.4 GB', 2], ['1:58', '980 MB', 0], ['1:36', '812 MB', 4], ['1:12', '604 MB', 6], ['0:58', '488 MB', 1], ['0:51', '431 MB', 7], ['0:44', '372 MB', 3], ['0:39', '330 MB', 5], ['0:31', '262 MB', 0], ['0:27', '228 MB', 6], ['0:22', '186 MB', 1], ['0:18', '152 MB', 4]];
  const sel = new Set([0, 1, 2, 4]);
  const grid = v.map(([d, sz, sc], i) => thumb(photo(sc, 1) + `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center">${icon('play', 30, 'rgba(255,255,255,.92)', 'text-shadow:0 2px 8px rgba(0,0,0,.4)')}</div>`, cell, sel.has(i), '', `${d} · ${sz}`)).join('');
  return `<div class="scr" style="background:${C.bg}">${statusBar()}${reviewTop('Large videos')}
    <div class="rbody"><div class="help">Videos over 100 MB, biggest first. Nothing is selected by default.</div>
    <div class="selAll">Select all ${LIB.vids.count}</div>
    <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:14px">${grid}</div></div>
    ${reviewBar('Delete 4 · 3.7 GB', IOS_NOTE)}</div>`;
}

// ---------- Cleaning ----------
// rowsP: array of 0..1 progress per row; t for pulse
function cleaning(s = {}) {
  const rows = [
    { k: 'duplicates', count: LIB.dup.count, bytes: LIB.dup.bytes },
    { k: 'temp', count: 186, bytes: LIB.temp.bytes },
  ];
  const ps = s.rowsP ?? [1, 1];
  const doneRows = ps.filter((p) => p >= 1).length;
  const finished = doneRows === rows.length;
  const cleared = rows.reduce((a, r, i) => a + (ps[i] >= 1 ? r.bytes : r.bytes * ps[i] * 0.98), 0);
  const top = finished && s.showCheck !== false
    ? `<div style="height:150px;display:flex;align-items:center;justify-content:center">${icon('checkmark-circle', 96, C.mint)}</div>`
    : pulse(150, s.t ?? 0, 'trash', C.mint);
  return `<div class="scr" style="background:linear-gradient(180deg,#0B1020,#12307A)">${statusBar(true)}
    <div style="padding:24px 22px 0;display:flex;flex-direction:column;align-items:center;gap:14px">${top}
    <div class="ctitle">${finished ? 'Cleaned!' : 'Cleaning your device…'}</div>
    <div class="csub">${fmtGB(cleared)} cleared</div>
    <div class="chint">${finished ? '' : `${doneRows} of ${rows.length} finished`}</div></div>
    <div style="display:flex;flex-direction:column;gap:10px;margin:28px 22px 0">${rows.map((r, i) => {
      const K = KINDS[r.k]; const p = ps[i];
      const st = p >= 1 ? icon('checkmark-circle', 24, C.mint) : p > 0 ? '<div class="spin"></div>' : icon('ellipse-outline', 22, '#6E7FB0');
      return `<div class="crow"><div class="cicon" style="background:${K.soft}">${icon(K.icon, 20, K.tone)}</div>
        <div style="flex:1;display:flex;flex-direction:column;gap:6px"><div style="display:flex;justify-content:space-between;gap:8px"><span class="crowTitle">${K.title}</span><span class="crowMeta">${n(r.count)} items · ${fmtGB(r.bytes)}</span></div>
        <div class="track"><div class="fill" style="width:${Math.max(p > 0 ? 10 : 0, p * 100)}%"></div></div></div>
        <div style="width:26px;display:flex;justify-content:center">${st}</div></div>`;
    }).join('')}</div></div>`;
}

// ---------- Done ----------
function done(s = {}) {
  const pop = s.pop ?? 1, cnt = s.count ?? 1;
  const bytes = (LIB.dup.bytes + LIB.temp.bytes) * ease(cnt);
  const spark = (top, left, size, c, o) => `<div style="position:absolute;top:${top};left:${left};opacity:${o}">${icon('sparkles', size, c)}</div>`;
  return `<div class="scr" style="background:linear-gradient(180deg,#0B1020,#12307A)">${statusBar(true)}
    <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:0 24px 180px">
      <div style="width:150px;height:150px;border-radius:75px;overflow:hidden;transform:scale(${pop});background:linear-gradient(135deg,${C.mint},${C.blue});display:flex;align-items:center;justify-content:center">${icon('checkmark', 72, '#fff')}</div>
      ${spark('27%', '64%', 34, C.mint, s.spark ?? 1)}${spark('33%', '22%', 22, '#fff', s.spark ?? 1)}${spark('40%', '76%', 26, '#8FB2FF', s.spark ?? 1)}
      <div style="display:flex;flex-direction:column;align-items:center;gap:6px;margin-top:34px;opacity:${s.textO ?? 1}">
        <div class="kicker">ALL DONE</div><div class="dbig">${fmtGB(bytes)} cleared</div>
        <div class="dsub">${n(LIB.dup.count)} items are in Recently Deleted. iPhone only gives the space back once you empty it, and apps aren’t allowed to do that for you. Tap below, unlock with Face ID, then Select › Delete All.</div>
      </div></div>
    <div style="position:absolute;left:24px;right:24px;bottom:34px;display:flex;flex-direction:column;gap:12px;opacity:${s.btnO ?? 1}">${btn('Open Recently Deleted', 'primary')}${btn('Done', 'light')}</div></div>`;
}

// ---------- Onboarding (privacy slide) ----------
function onboardingPrivacy() {
  return `<div class="scr" style="background:${C.bg}">${statusBar()}
    <div style="position:absolute;inset:0 0 140px;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:0 28px">
      <div style="position:relative;width:200px;height:200px;margin-bottom:44px"><div style="position:absolute;inset:0;border-radius:56px;background:linear-gradient(135deg,${C.violet},#FF6BA8);display:flex;align-items:center;justify-content:center">${icon('lock-closed-outline', 96, '#fff')}</div>
        <div style="position:absolute;top:-10px;right:-6px">${icon('sparkles', 34, C.violet)}</div><div style="position:absolute;bottom:6px;left:-14px">${icon('sparkles', 22, '#FF6BA8')}</div></div>
      <div class="otitle">Private by design</div>
      <div class="obody">Everything happens on your device. Your photos are never uploaded, shared or tracked. No account needed.</div></div>
    <div style="position:absolute;left:0;right:0;bottom:118px;display:flex;justify-content:center;gap:6px"><div class="dot" style="width:8px;opacity:.3"></div><div class="dot" style="width:8px;opacity:.3"></div><div class="dot" style="width:26px"></div></div>
    <div style="position:absolute;left:24px;right:24px;bottom:34px">${btn('Get started', 'primary')}</div></div>`;
}

const SCREEN_CSS = `
@font-face{font-family:Inter;font-weight:400;src:url(fonts/Inter_400Regular.ttf)}
@font-face{font-family:Inter;font-weight:500;src:url(fonts/Inter_500Medium.ttf)}
@font-face{font-family:Inter;font-weight:600;src:url(fonts/Inter_600SemiBold.ttf)}
@font-face{font-family:Inter;font-weight:700;src:url(fonts/Inter_700Bold.ttf)}
@font-face{font-family:Inter;font-weight:800;src:url(fonts/Inter_800ExtraBold.ttf)}
@font-face{font-family:Fraunces;font-weight:700;src:url(fonts/Fraunces_700Bold.ttf)}
@font-face{font-family:Fraunces;font-weight:900;src:url(fonts/Fraunces_900Black.ttf)}
@font-face{font-family:Ionicons;src:url(fonts/Ionicons.ttf)}
*{box-sizing:border-box;margin:0;padding:0}
.ion{font-family:Ionicons;font-style:normal;line-height:1;display:inline-block}
.scr{position:absolute;inset:0;width:440px;height:956px;overflow:hidden;font-family:Inter;color:${C.ink}}
.sb{height:54px;padding:18px 34px 0 46px;display:flex;justify-content:space-between;font-weight:600;font-size:17px;position:relative;z-index:3}
.sbr{display:flex;gap:6px;align-items:center}
.scroll{padding:8px 20px 32px}
.hdr{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px}
.brand{display:flex;align-items:center;gap:10px}.brandText{font-family:Fraunces;font-weight:700;font-size:26px;letter-spacing:-.5px}
.gear{width:44px;height:44px;border-radius:22px;background:#fff;display:flex;align-items:center;justify-content:center;box-shadow:0 8px 18px rgba(27,42,89,.08)}
.card{background:#fff;border-radius:26px;box-shadow:0 8px 18px rgba(27,42,89,.08)}
.hero{display:flex;flex-direction:column;align-items:center;gap:18px;padding:24px 20px}
.eyebrow{font-weight:700;font-size:12px;letter-spacing:1.6px;color:${C.ink3}}
.big{font-family:Fraunces;font-weight:700;font-size:34px;letter-spacing:-1px}
.sub{font-weight:500;font-size:14px;color:${C.ink3};margin-top:2px}
.note{font-size:13.5px;line-height:19px;color:${C.ink2};text-align:center}
.cardTitle{font-weight:700;font-size:17px;margin-bottom:14px}
.bar{height:10px;border-radius:5px;background:${C.line};overflow:hidden;margin-bottom:10px}.barFill{height:100%;border-radius:5px;background:${C.blue}}
.btn{border-radius:999px;padding:17px 26px;display:flex;align-items:center;justify-content:center;gap:10px;font-weight:700;font-size:17px;letter-spacing:.1px;position:relative;overflow:hidden;white-space:nowrap}
.section{font-weight:700;font-size:20px;margin-bottom:2px}
.cat{display:flex;align-items:center;gap:14px;padding:16px}
.catIcon{width:52px;height:52px;border-radius:16px;display:flex;align-items:center;justify-content:center;flex:none}
.catTitle{font-weight:600;font-size:16.5px}.catHint{font-size:13px;color:${C.ink3};margin-top:2px;line-height:18px}
.catBytes{font-weight:700;font-size:17px;white-space:nowrap}.catCount{font-size:12.5px;color:${C.ink3};margin-top:2px;white-space:nowrap}
.foot{font-size:12.5px;line-height:18px;color:${C.ink3};text-align:center;margin-top:4px}
.life{display:flex;align-items:center;justify-content:center;gap:8px;margin-top:26px;font-weight:600;font-size:14px;color:${C.ink2}}.life b{color:${C.ink}}
.rtop{display:flex;align-items:center;justify-content:space-between;padding:6px 12px 10px}
.back{width:44px;height:44px;display:flex;align-items:center;justify-content:center}.rtitle{flex:1;text-align:center;font-weight:700;font-size:18px}
.rbody{padding:0 20px}
.help{font-size:14px;line-height:20px;color:${C.ink2}}
.selAll{align-self:flex-start;display:inline-block;margin-top:12px;padding:8px 14px;border-radius:999px;background:${C.blueSoft};color:${C.blue};font-weight:600;font-size:14px}
.group{background:#fff;border-radius:18px;padding:16px;display:flex;flex-direction:column;gap:10px}
.groupMeta{font-weight:600;font-size:13px;color:${C.ink3}}
.thumb{position:relative;border-radius:14px;overflow:hidden;background:${C.line};flex:none}.thumb svg{position:absolute;inset:0;width:100%;height:100%}
.check{position:absolute;top:7px;right:7px;width:24px;height:24px;border-radius:12px;border:2px solid #fff;background:rgba(0,0,0,.25);display:flex;align-items:center;justify-content:center}
.badge{position:absolute;top:7px;left:7px;background:${C.mint};border-radius:8px;padding:2px 7px;font-weight:700;font-size:11px;color:${C.navy}}
.meta{position:absolute;left:6px;bottom:6px;background:rgba(11,16,32,.7);border-radius:7px;padding:2px 6px;font-weight:600;font-size:11px;color:#fff}
.rbar{position:absolute;left:0;right:0;bottom:0;padding:14px 20px 30px;background:rgba(246,248,252,.96);border-top:.5px solid ${C.line};display:flex;flex-direction:column;gap:8px}
.barNote{font-size:12px;color:${C.ink3};text-align:center}
.ctitle{font-family:Fraunces;font-weight:700;font-size:30px;color:#fff;letter-spacing:-.5px;text-align:center}
.csub{font-weight:700;font-size:20px;color:${C.mint}}.chint{font-size:14px;color:#B6C3EA;min-height:18px}
.crow{display:flex;align-items:center;gap:12px;background:rgba(255,255,255,.08);border-radius:18px;padding:14px}
.cicon{width:40px;height:40px;border-radius:12px;display:flex;align-items:center;justify-content:center;flex:none}
.crowTitle{font-weight:600;font-size:15px;color:#fff}.crowMeta{font-weight:500;font-size:12.5px;color:#B6C3EA}
.track{height:6px;border-radius:3px;background:rgba(255,255,255,.14);overflow:hidden}.fill{height:100%;border-radius:3px;background:${C.mint}}
.spin{width:20px;height:20px;border-radius:10px;border:2.5px solid rgba(255,255,255,.25);border-top-color:#fff}
.kicker{font-weight:700;font-size:14px;letter-spacing:2px;color:${C.mint}}
.dbig{font-family:Fraunces;font-weight:700;font-size:44px;color:#fff;letter-spacing:-1px;text-align:center}
.dsub{font-size:15px;line-height:22px;color:#B6C3EA;text-align:center;max-width:340px;margin-top:6px}
.otitle{font-family:Fraunces;font-weight:700;font-size:36px;letter-spacing:-.8px;text-align:center}
.obody{font-size:17px;line-height:25px;color:${C.ink2};text-align:center;margin-top:14px;max-width:340px}
.dot{height:8px;border-radius:4px;background:${C.blue}}
`;

// Phone frame around a 440x956 screen, scaled to `w` px wide.
function phone(screenHtml, w) {
  const k = w / 440, bez = Math.round(14 * k);
  return `<div style="position:relative;width:${w + bez * 2}px;height:${956 * k + bez * 2}px;border-radius:${70 * k}px;background:linear-gradient(145deg,#2A2F3F,#0C0F18);padding:${bez}px;box-shadow:0 ${40 * k}px ${80 * k}px rgba(11,16,48,.35), inset 0 0 0 ${2 * k}px #454B5E">
    <div style="position:relative;width:${w}px;height:${956 * k}px;border-radius:${58 * k}px;overflow:hidden;background:#000">
      <div style="position:absolute;left:0;top:0;width:440px;height:956px;transform:scale(${k});transform-origin:0 0">${screenHtml}</div>
      <div style="position:absolute;left:50%;top:${11 * k}px;width:${124 * k}px;height:${36 * k}px;margin-left:${-62 * k}px;border-radius:${20 * k}px;background:#000;z-index:9"></div>
    </div></div>`;
}
