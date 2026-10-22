const { chromium } = require('playwright');
(async () => {
  const out = process.argv[2]; const keys = process.argv.slice(3);
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' in {} ? undefined : undefined });
  const p = await b.newPage({ viewport: { width: 1320, height: 2868 }, deviceScaleFactor: 1 });
  let i = 1;
  for (const k of keys) {
    await p.goto(`http://localhost:8765/shots.html?s=${k}`);
    await p.waitForSelector('body[data-ready="1"]');
    await p.waitForTimeout(300);
    await p.screenshot({ path: `${out}/appstore-6.9in-${String(i++).padStart(2, '0')}-${k}.png` });
  }
  await b.close();
})();
