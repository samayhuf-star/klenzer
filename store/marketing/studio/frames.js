const { chromium } = require('playwright');
const { spawn } = require('child_process');
(async () => {
  const mode = process.argv[2];
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 886, height: 1920 }, deviceScaleFactor: 1 });
  await p.goto('http://localhost:8765/video.html');
  await p.waitForSelector('body[data-ready="1"]');
  if (mode === 'stills') {
    for (const t of process.argv.slice(3)) {
      await p.evaluate((t) => window.render(t), Number(t));
      await p.screenshot({ path: `still-${t}.png` });
    }
  } else {
    const fps = 30, dur = 25, out = process.argv[3];
    const ff = spawn('ffmpeg', ['-y', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'png', '-i', '-',
      '-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100',
      '-shortest', '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-r', String(fps),
      '-c:a', 'aac', '-b:a', '256k', '-movflags', '+faststart', out], { stdio: ['pipe', 'ignore', 'inherit'] });
    for (let f = 0; f < fps * dur; f++) {
      await p.evaluate((t) => window.render(t), f / fps);
      const buf = await p.screenshot({ type: 'png' });
      if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
    }
    ff.stdin.end();
    await new Promise((r) => ff.on('close', r));
  }
  await b.close();
})();
