/* End-to-end tests. Needs playwright (npm i -D playwright && npx playwright install chromium),
   python3 and ffmpeg/ffprobe on PATH:  node tests/e2e.mjs
   This Chromium may lack H.264/AAC; the preview test substitutes VP9 and checks the container. */
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import { spawn, execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const ASSETS = path.join(HERE, '.out', 'assets'); fs.mkdirSync(ASSETS, { recursive: true });
execSync(`ffmpeg -hide_banner -loglevel error -y -f lavfi -i "testsrc2=size=1290x2796:rate=30:duration=4" -f lavfi -i "sine=frequency=440:duration=4" -c:v libvpx-vp9 -b:v 2M -c:a libopus "${ASSETS}/test.webm"`);
execSync(`ffmpeg -hide_banner -loglevel error -y -f lavfi -i "testsrc2=size=1290x2796:rate=1:duration=1" -frames:v 1 "${ASSETS}/shot1.png"`);
execSync(`ffmpeg -hide_banner -loglevel error -y -f lavfi -i "color=c=0x3355ff:size=1290x2796:rate=1:duration=1" -frames:v 1 "${ASSETS}/shot2.png"`);
const OUT = path.join(HERE, '.out', 'e2e'); fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });
const server = spawn('python3', ['-m', 'http.server', '8911'], { cwd: ROOT, stdio: 'ignore' });
await new Promise(r => setTimeout(r, 800));

let failures = 0;
const check = (ok, msg) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg); if (!ok) failures++; };
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const context = await browser.newContext({ viewport: { width: 1500, height: 1000 }, acceptDownloads: true });
const page = await context.newPage();
const errors = [];
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

const URL_ = 'http://localhost:8911/index.html';
await page.goto(URL_);
await page.waitForTimeout(600);

/* 1. media upload */
await page.setInputFiles('#fileInput', [`${ASSETS}/shot1.png`, `${ASSETS}/shot2.png`, `${ASSETS}/test.webm`]);
await page.waitForFunction(() => document.querySelectorAll('#thumbs .thumb').length === 3, null, { timeout: 15000 });
check(true, 'three media items added');
const st = await page.evaluate(() => ({ phones: cur().phones.map(p => !!p.media), media: media.map(m => m.kind), active: project.active, slides: project.slides.length }));
check(st.phones[0] && st.media.join() === 'image,image,video', 'first image assigned to phone 1 · ' + JSON.stringify(st));

/* 2. template + slides */
await page.evaluate(() => document.querySelector('section[data-sec="templates"] h2').click());
await page.click('#templateGrid button:nth-child(5)');   // Trio Fan: 3 phones
await page.waitForTimeout(200);
const trio = await page.evaluate(() => ({ n: cur().phones.length, media: cur().phones.map(p => p.media && mediaById(p.media).kind), head: cur().headline }));
check(trio.n === 3 && trio.media.filter(Boolean).length === 3, 'Trio Fan assigns 3 phones with media · ' + JSON.stringify(trio));
await page.click('#addSlide'); await page.waitForTimeout(150);
await page.click('#addSlide'); await page.waitForTimeout(150);
const sl = await page.evaluate(() => ({ n: project.slides.length, active: project.active, strip: document.querySelectorAll('#slideStrip .slide').length }));
check(sl.n === 3 && sl.active === 2 && sl.strip === 3, 'added slides · ' + JSON.stringify(sl));
await page.fill('#headline', 'Second screen headline'); await page.waitForTimeout(100);
await page.evaluate(() => selectSlide(0));
const h0 = await page.evaluate(() => cur().headline);
check(h0 === 'Three views. One app.', 'per-slide headline kept · ' + h0);
// undo / redo
await page.evaluate(() => selectSlide(2));
await page.evaluate(() => { flushHistory(); });
const before = await page.evaluate(() => cur().headline);
await page.fill('#headline', 'Changed'); await page.waitForTimeout(600);
await page.keyboard.press('Escape'); await page.evaluate(() => document.activeElement.blur());
await page.keyboard.press('Control+z'); await page.waitForTimeout(100);
const afterUndo = await page.evaluate(() => cur().headline);
check(afterUndo === before, `undo restores headline (${before} ← Changed) got "${afterUndo}"`);
await page.keyboard.press('Control+Shift+z'); await page.waitForTimeout(100);
check((await page.evaluate(() => cur().headline)) === 'Changed', 'redo re-applies');

/* 3. canvas drag */
const box = await page.locator('#canvas').boundingBox();
const phoneBefore = await page.evaluate(() => { selectSlide(0); return { ...cur().phones[2] }; });
const p0 = await page.evaluate(() => { const p = layout.phones[2]; const r = canvas.getBoundingClientRect(); return { x: r.left + p.cx * r.width / canvas.width, y: r.top + p.cy * r.height / canvas.height }; });
await page.mouse.move(p0.x, p0.y); await page.mouse.down(); await page.mouse.move(p0.x + 40, p0.y + 30, { steps: 5 }); await page.mouse.up();
await page.waitForTimeout(100);
const phoneAfter = await page.evaluate(() => ({ ...cur().phones[2], active: activePhone }));
check(phoneAfter.x > phoneBefore.x && phoneAfter.y > phoneBefore.y && phoneAfter.active === 2, 'dragging a phone moves it and selects it · ' + JSON.stringify({ phoneBefore, phoneAfter }));

/* 4. export PNG (current slide) */
let dl = page.waitForEvent('download');
await page.click('#exportBtn');
let d = await dl; const pngPath = path.join(OUT, d.suggestedFilename()); await d.saveAs(pngPath);
const probe = execSync(`ffprobe -v error -select_streams v:0 -show_entries stream=width,height,pix_fmt -of csv=p=0 "${pngPath}"`).toString().trim();
check(probe === '1320,2868,rgb24', `exported PNG is 1320×2868 rgb24 (no alpha) · ${probe} · ${d.suggestedFilename()}`);

/* 5. export set zip (2 sizes × 3 slides) */
await page.evaluate(() => { project.export.sizes = ['ip69', 'ipad13']; project.export.scope = 'all'; });
await page.click('#exportSetBtn'); await page.waitForSelector('#exportDlg[open]');
const checked = await page.evaluate(() => [...document.querySelectorAll('#exSizes input:checked')].map(i => i.value));
check(checked.join() === 'ip69,ipad13', 'export dialog reflects selected sizes · ' + checked.join());
dl = page.waitForEvent('download', { timeout: 120000 });
await page.click('#exportSetGo');
d = await dl; const zipPath = path.join(OUT, d.suggestedFilename()); await d.saveAs(zipPath);
const list = execSync(`unzip -l "${zipPath}"`).toString();
const names = list.split('\n').filter(l => /\.png$/.test(l)).map(l => l.trim().split(/\s+/).slice(3).join(' '));
check(names.length === 6, 'zip holds 6 PNGs · ' + names.join(' | '));
check(names.some(n => n.startsWith('iPhone-6.9 1320x2868/01-')) && names.some(n => n.startsWith('iPad-13 2064x2752/03-')), 'zip folder layout');
execSync(`cd "${OUT}" && unzip -o -q "${zipPath}"`);
const ipadProbe = execSync(`ffprobe -v error -select_streams v:0 -show_entries stream=width,height,pix_fmt -of csv=p=0 "${OUT}/${names.find(n => n.startsWith('iPad-13'))}"`).toString().trim();
check(ipadProbe === '2064,2752,rgb24', 'iPad PNG in zip is 2064×2752 rgb24 · ' + ipadProbe);
check(/No errors detected/.test(execSync(`unzip -t "${zipPath}"`).toString()), 'zip integrity');

/* 6. fastlane layout + jpg */
await page.evaluate(() => { project.export.layout = 'fastlane'; project.export.format = 'jpg'; project.export.scope = 'current'; project.export.sizes = ['ip69']; });
await page.click('#exportSetBtn'); await page.waitForSelector('#exportDlg[open]');
dl = page.waitForEvent('download', { timeout: 60000 }); await page.click('#exportSetGo'); d = await dl;
const zip2 = path.join(OUT, 'fastlane.zip'); await d.saveAs(zip2);
const l2 = execSync(`unzip -l "${zip2}"`).toString();
check(/en-US\/01_iPhone-6\.9_three-views-one-app\.jpg/.test(l2), 'fastlane flat layout + jpg · ' + l2.split('\n').filter(l => /jpg/.test(l)).join(','));

/* 7. preview export via WebCodecs pipeline (VP9 stands in for H.264 in this Chromium; a fake avcC lets the muxer run) */
await page.evaluate(() => {
  const Orig = window.VideoEncoder;
  window.VideoEncoder = class extends Orig {
    constructor(init) { super({ ...init, output: (chunk, meta) => init.output(chunk, { decoderConfig: { description: new Uint8Array([1, 100, 0, 42, 255, 225, 0, 4, 103, 100, 0, 42, 1, 0, 2, 104, 1]) } }) }); }
  };
  ui.encoders = { webcodecs: true, h264: 'vp09.00.10.08', aac: false, recorder: true };
  // put the video on slide 3 in fill mode
  selectSlide(2); const v = media.find(m => m.kind === 'video'); cur().phones[0].media = v.id; cur().fillMode = true; project.video.len = 15; project.video.loop = true; syncAll(); render();
});
await page.click('#previewBtn'); await page.waitForSelector('#previewDlg[open]');
const pvSel = await page.evaluate(() => $('pvSize').value);
check(pvSel === 'pv_ip', 'preview dialog picks the iPhone preview size · ' + pvSel);
const warnTxt = await page.evaluate(() => $('pvWarn').textContent);
check(/Exports 15 s at 886×1920/.test(warnTxt), 'preview dialog summary · ' + warnTxt);
dl = page.waitForEvent('download', { timeout: 240000 });
const t0 = Date.now();
await page.click('#previewGo');
d = await dl; const mp4Path = path.join(OUT, d.suggestedFilename()); await d.saveAs(mp4Path);
console.log('  preview encode took', ((Date.now() - t0) / 1000).toFixed(1), 's');
const mp = JSON.parse(execSync(`ffprobe -v error -show_entries format=duration:stream=codec_name,width,height,r_frame_rate,nb_frames -of json "${mp4Path}"`).toString());
const vs = mp.streams[0];
check(vs && vs.width === 886 && vs.height === 1920 && vs.r_frame_rate === '30/1' && +vs.nb_frames === 450 && Math.abs(+mp.format.duration - 15) < 0.01,
  'preview MP4: 886×1920, 30 fps, 450 frames, 15.000 s · ' + JSON.stringify(mp));
check(d.suggestedFilename().endsWith('-preview-886x1920.mp4'), 'preview filename · ' + d.suggestedFilename());
const presetAfter = await page.evaluate(() => project.preset);
check(presetAfter === 'pv_ip', 'preset switched to the preview size');

/* 7b. autosave keeps firing while a video plays (throttle, not debounce) */
await page.evaluate(() => { selectSlide(1); project.slides[1].headline = 'Autosave probe'; cur().phones[0].media = media.find(m => m.kind === 'video').id; syncAll(); render(); ensureLoop(); });
await page.waitForTimeout(1500);
const lsHead = await page.evaluate(() => JSON.parse(localStorage.getItem('sstudio.v2')).slides[1].headline);
check(lsHead === 'Autosave probe', 'autosave written while a video is playing · ' + lsHead);
const looping = await page.evaluate(() => rafId !== null);
check(looping, 'playback loop is running after exports');
/* 8. reload persistence (media + project) */
await page.reload(); await page.waitForTimeout(1500);
const persisted = await page.evaluate(() => ({ media: media.length, slides: project.slides.length, head: project.slides[0].headline, phones: project.slides[0].phones.map(p => !!mediaById(p.media)) }));
check(persisted.media === 3 && persisted.slides === 3 && persisted.head === 'Three views. One app.' && persisted.phones.every(Boolean), 'media and project survive a reload · ' + JSON.stringify(persisted));

/* 9. checklist */
await page.click('#checkBtn'); await page.waitForSelector('#checkDlg[open]');
const checks = await page.evaluate(() => [...document.querySelectorAll('#checkBody .check')].map(c => c.className.replace('check ', '') + ': ' + c.firstElementChild.nextElementSibling.firstChild.textContent));
console.log('  checklist:\n   ' + checks.join('\n   '));
check(checks.length >= 8, 'checklist renders');
await page.keyboard.press('Escape');

/* 10. legacy project file load */
const legacy = { preset: 2, phones: [{ img: 0, scale: 1, tilt: 5, x: 0.1, y: 0 }], bg1: '#ff0000', bg2: '#00ff00', headline: 'Legacy', sub: '', head: { font: 2, weight: 800, size: 1, color: '#fff', italic: false, caps: false, spacing: 0 }, subx: { font: 0, weight: 400, size: 1, color: '#fff', italic: false, caps: false, spacing: 0 } };
fs.writeFileSync(path.join(OUT, 'legacy.json'), JSON.stringify(legacy));
await page.setInputFiles('#loadInput', path.join(OUT, 'legacy.json')); await page.waitForTimeout(300);
const leg = await page.evaluate(() => ({ preset: project.preset, head: cur().headline, bg1: cur().bg1, tilt: cur().phones[0].tilt, font: cur().head.font }));
check(leg.preset === 'ip65b' && leg.head === 'Legacy' && leg.bg1 === '#ff0000' && leg.tilt === 5 && leg.font === 2, 'v1 settings file migrates · ' + JSON.stringify(leg));

/* 11. MediaRecorder fallback path */
await page.evaluate(() => { ui.encoders = { webcodecs: false, h264: null, aac: false, recorder: true }; const v = media.find(m => m.kind === 'video'); cur().phones[0].media = v.id; cur().fillMode = true; syncAll(); render(); });
await page.click('#previewBtn'); await page.waitForSelector('#previewDlg[open]');
const encTxt = await page.evaluate(() => $('pvEncoder').textContent);
check(/MediaRecorder/.test(encTxt), 'fallback path announced · ' + encTxt.slice(0, 60));
dl = page.waitForEvent('download', { timeout: 60000 }); await page.click('#previewGo'); d = await dl;
const recPath = path.join(OUT, d.suggestedFilename()); await d.saveAs(recPath);
const rp = execSync(`ffprobe -v error -select_streams v:0 -show_entries stream=codec_name,width,height -of csv=p=0 "${recPath}"`).toString().trim();
check(/886,1920/.test(rp), 'fallback recording has the preview dimensions · ' + rp + ' · ' + d.suggestedFilename());

/* screenshots of the UI */
await page.evaluate(() => { selectSlide(0); project.preset = 'ip69'; syncAll(); render(); });
await page.waitForTimeout(300);
await page.screenshot({ path: path.join(OUT, 'ui.png') });

check(errors.length === 0, 'no console/page errors' + (errors.length ? ':\n   ' + errors.join('\n   ') : ''));
await browser.close(); server.kill();
console.log(failures ? `\n${failures} FAILURE(S)` : '\nALL E2E PASS');
process.exit(failures ? 1 : 0);
