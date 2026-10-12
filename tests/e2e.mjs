/* End-to-end tests (developer only — the app itself needs nothing). Needs playwright (npm i -D playwright && npx playwright install chromium),
   and ffmpeg/ffprobe on PATH:  node tests/e2e.mjs
   The page is opened straight from disk (file://) — no web server — exactly as a user double-clicking it would.
   This Chromium may lack H.264/AAC; the preview test substitutes VP9 and checks the container. */
import { chromium } from 'playwright';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const ASSETS = path.join(HERE, '.out', 'assets'); fs.mkdirSync(ASSETS, { recursive: true });
execSync(`ffmpeg -hide_banner -loglevel error -y -f lavfi -i "testsrc2=size=1290x2796:rate=30:duration=4" -f lavfi -i "sine=frequency=440:duration=4" -c:v libvpx-vp9 -b:v 2M -c:a libopus "${ASSETS}/test.webm"`);
execSync(`ffmpeg -hide_banner -loglevel error -y -f lavfi -i "testsrc2=size=1290x2796:rate=1:duration=1" -frames:v 1 "${ASSETS}/shot1.png"`);
execSync(`ffmpeg -hide_banner -loglevel error -y -f lavfi -i "color=c=0x3355ff:size=1290x2796:rate=1:duration=1" -frames:v 1 "${ASSETS}/shot2.png"`);
execSync(`ffmpeg -hide_banner -loglevel error -y -f lavfi -i "sine=frequency=1000:sample_rate=44100:duration=8" -ac 2 "${ASSETS}/music.wav"`);
execSync(`ffmpeg -hide_banner -loglevel error -y -f lavfi -i "testsrc2=size=640x1386:rate=30:duration=3" -c:v libvpx-vp9 -b:v 1M -an "${ASSETS}/noaudio.webm"`);
const OUT = path.join(HERE, '.out', 'e2e'); fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });

let failures = 0;
const check = (ok, msg) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg); if (!ok) failures++; };
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const context = await browser.newContext({ viewport: { width: 1500, height: 1000 }, acceptDownloads: true });
const page = await context.newPage();
const errors = [];
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

const URL_ = pathToFileURL(path.join(ROOT, 'index.html')).href;
await page.goto(URL_);
await page.waitForTimeout(600);

/* 1. media upload */
await page.setInputFiles('#fileInput', [`${ASSETS}/shot1.png`, `${ASSETS}/shot2.png`, `${ASSETS}/test.webm`]);
await page.waitForFunction(() => document.querySelectorAll('#thumbs .thumb').length === 3, null, { timeout: 15000 });
check(true, 'three media items added');
const st = await page.evaluate(() => ({ phones: cur().phones.map(p => !!p.media), media: media.map(m => m.kind), active: project.active, slides: project.slides.length }));
check(st.phones[0] && st.media.join() === 'image,image,video', 'first image assigned to phone 1 · ' + JSON.stringify(st));

/* 2. template + slides */
await page.evaluate(() => openSection('templates'));
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

/* 12. audio: soundtrack upload, silent-video detection, mixed AAC in the exported preview */
const tonePower = (file, freqs) => {             // relative power of each frequency in the decoded audio (Goertzel)
  execSync(`ffmpeg -v error -y -i "${file}" -map 0:a -ac 1 -ar 48000 -f f32le -acodec pcm_f32le "${file}.f32"`);
  const raw = fs.readFileSync(`${file}.f32`), x = new Float32Array(raw.buffer, raw.byteOffset, raw.length / 4);
  /* measured in 0.25 s blocks and averaged, so phase jumps at video loop points don't cancel the tone out */
  const B = 12000;
  return freqs.map(f => { const w = 2 * Math.PI * f / 48000, cf = 2 * Math.cos(w); let sum = 0, cnt = 0;
    for (let o = 0; o + B <= x.length; o += B) {
      let s1 = 0, s2 = 0, tot = 0;
      for (let i = o; i < o + B; i++) { const v = x[i]; tot += v * v; const s0 = v + cf * s1 - s2; s2 = s1; s1 = s0; }
      if (tot > 1e-9) { sum += (s1 * s1 + s2 * s2 - cf * s1 * s2) / (tot * B / 2); cnt++; }
    }
    return cnt ? sum / cnt : 0; });
};
await page.evaluate(() => { ui.encoders = null; });
await page.setInputFiles('#fileInput', [`${ASSETS}/music.wav`, `${ASSETS}/noaudio.webm`]);
await page.waitForFunction(() => media.some(m => m.kind === 'audio') && media.some(m => m.name === 'noaudio'), null, { timeout: 20000 });
await page.waitForFunction(() => media.find(m => m.name === 'noaudio').hasAudio, null, { timeout: 20000 });
const au1 = await page.evaluate(() => ({
  music: mediaById(project.video.music)?.name, kind: mediaById(project.video.music)?.kind,
  sel: $('musicSel').value === project.video.music, audioThumb: !!document.querySelector('#thumbs .thumb.audio.sel'),
  noaudio: media.find(m => m.name === 'noaudio').hasAudio, muteTag: document.querySelectorAll('#thumbs .thumb .mute').length,
  withAudio: media.find(m => m.name === 'test').hasAudio,
}));
check(au1.music === 'music' && au1.kind === 'audio' && au1.sel && au1.audioThumb, 'WAV upload becomes the soundtrack · ' + JSON.stringify(au1));
check(au1.noaudio === 'none' && au1.muteTag >= 1 && au1.withAudio === 'yes', 'videos with and without sound are detected');
/* sound monitoring toggle unmutes the shown video */
await page.evaluate(() => { selectSlide(2); const v = media.find(m => m.name === 'test'); cur().phones[0].media = v.id; cur().fillMode = true; project.video.len = 15; project.video.loop = true; project.video.audio = true; project.video.videoVol = 1; project.video.musicVol = 0.8; syncAll(); render(); });
await page.click('#soundBtn');
const mon = await page.evaluate(() => ({ on: ui.sound, muted: media.find(m => m.name === 'test').el.muted, note: $('audioNote').textContent }));
check(mon.on && !mon.muted && /video sound \+ soundtrack "music"/.test(mon.note), 'sound toggle unmutes the editor; audio plan lists both sources · ' + mon.note);
await page.click('#soundBtn');
/* export with both sources — this Chromium has no AAC encoder, so the built-in encoder runs */
await page.evaluate(() => {
  /* the page was reloaded since section 7, so re-apply the VP9-for-H.264 stand-in */
  const Orig = window.VideoEncoder;
  window.VideoEncoder = class extends Orig {
    constructor(init) { super({ ...init, output: (chunk, meta) => init.output(chunk, { decoderConfig: { description: new Uint8Array([1, 100, 0, 42, 255, 225, 0, 4, 103, 100, 0, 42, 1, 0, 2, 104, 1]) } }) }); }
  };
  ui.encoders = { webcodecs: true, h264: 'vp09.00.10.08', aac: false, recorder: true };
});
const exportPreview = async (file) => {
  await page.click('#previewBtn'); await page.waitForSelector('#previewDlg[open]');
  const note = await page.evaluate(() => $('pvAudioNote').textContent);
  const dlp = page.waitForEvent('download', { timeout: 300000 });
  const failed = page.waitForSelector('.toast.err', { timeout: 300000 }).then(async el => { throw new Error('export failed: ' + await el.textContent()); });
  await page.click('#previewGo'); const dd = await Promise.race([dlp, failed]);
  const fp = path.join(OUT, file); await dd.saveAs(fp); return { fp, note };
};
let r1 = await exportPreview('audio-both.mp4');
const a1 = JSON.parse(execSync(`ffprobe -v error -select_streams a:0 -show_entries stream=codec_name,profile,sample_rate,channels,duration,bit_rate -of json "${r1.fp}"`).toString()).streams[0];
console.log('  preview audio', JSON.stringify(a1), '·', r1.note);
check(a1 && a1.codec_name === 'aac' && a1.profile === 'LC' && +a1.sample_rate === 48000 && a1.channels === 2, 'exported preview has stereo AAC-LC 48 kHz audio');
check(Math.abs(+a1.duration - 15) < 0.05, `audio length ${a1.duration}s matches the 15 s preview`);
check(+a1.bit_rate <= 270000, `audio bitrate ${Math.round(a1.bit_rate / 1000)} kbps within Apple's 256 kbps`);
const [p440, p1k] = tonePower(r1.fp, [440, 1000]);
console.log(`  tone power: 440 Hz ${p440.toFixed(3)}, 1 kHz ${p1k.toFixed(3)}`);
check(p440 > 0.3 && p1k > 0.2, 'mix contains the video sound (440 Hz) and the soundtrack (1 kHz)');
/* video sound off: only the soundtrack remains */
await page.evaluate(() => { project.video.audio = false; syncAll(); });
let r2 = await exportPreview('audio-music-only.mp4');
const [q440, q1k] = tonePower(r2.fp, [440, 1000]);
console.log(`  music only: 440 Hz ${q440.toFixed(4)}, 1 kHz ${q1k.toFixed(3)}`);
check(q440 < 0.01 && q1k > 0.9, 'turning off the video sound leaves just the soundtrack');
/* nothing to play: the dialog says the preview will be silent */
await page.evaluate(() => { project.video.music = null; project.video.audio = true; const v = media.find(m => m.name === 'noaudio'); cur().phones[0].media = v.id; syncAll(); render(); });
await page.click('#previewBtn'); await page.waitForSelector('#previewDlg[open]');
const silentNote = await page.evaluate(() => $('pvAudioNote').textContent);
check(/No audio: "noaudio" has no audio track/.test(silentNote), 'dialog explains a silent preview · ' + silentNote);
await page.keyboard.press('Escape');
await page.evaluate(() => { project.video.audio = true; const v = media.find(m => m.name === 'test'); cur().phones[0].media = v.id; project.video.music = media.find(m => m.kind === 'audio').id; syncAll(); render(); });

/* 13. complete-set templates: cards, dialog, build (every screenshot used, in order), restyle (captions kept) */
await page.evaluate(() => { project.preset = 'ip69'; syncAll(); render(); openSection('templates'); refreshSetCards(); });
const cards = await page.evaluate(() => ({ n: document.querySelectorAll('#setGrid .setcard').length, canvases: document.querySelectorAll('#setGrid .setcard canvas').length, templates: SET_TEMPLATES.length }));
check(cards.n === cards.templates && cards.canvases === cards.n * 3, 'a card with a three-slide preview per set template · ' + JSON.stringify(cards));
await page.click('#setGrid .setcard:nth-child(2)'); await page.waitForSelector('#setDlg[open]');
const dlg = await page.evaluate(() => ({ title: $('setTitle').textContent, previews: document.querySelectorAll('#setPreview canvas').length, plan: $('setPlan').textContent, shots: screenshots().length }));
check(dlg.title === 'Midnight Spotlight' && dlg.previews === dlg.shots && /every screenshot ends up in the set/.test(dlg.plan), 'set dialog previews one slide per screenshot · ' + JSON.stringify(dlg));
await page.click('#setBuild'); await page.waitForTimeout(300);
const built = await page.evaluate(() => ({
  n: project.slides.length, active: project.active, strip: document.querySelectorAll('#slideStrip .slide').length,
  order: project.slides.map(s => s.phones.map(p => mediaById(p.media)?.name).join('+')), lib: screenshots().map(m => m.name),
  bg: project.slides.map(s => s.bgType + ' ' + s.bg1), heads: project.slides.map(s => s.headline), sample: project.slides.every(s => s.sampleHead),
}));
check(built.n === 2 && built.strip === 2 && built.active === 0, 'Build set makes one slide per screenshot · ' + JSON.stringify(built));
check(built.order.join() === built.lib.join(), 'screenshots land on slides in library order · ' + built.order.join(' | '));
check(built.bg[0] !== built.bg[1] && built.bg.every(b => b.startsWith('spotlight')), 'per-slide hue variation applied · ' + built.bg.join(' | '));
check(built.heads.every(Boolean) && built.sample, 'sample captions set and flagged as samples');
// restyle keeps a real caption and the media
await page.evaluate(() => { selectSlide(1); });
await page.fill('#headline', 'My real caption'); await page.waitForTimeout(100);
await page.click('#setGrid .setcard:nth-child(7)'); await page.waitForSelector('#setDlg[open]');
await page.click('#setRestyle'); await page.waitForTimeout(300);
const restyled = await page.evaluate(() => ({ n: project.slides.length, head1: project.slides[1].headline, sample1: project.slides[1].sampleHead, head0: project.slides[0].sampleHead, bg: project.slides[0].bgType, font: project.slides[0].head.font, media: project.slides.map(s => mediaById(s.phones[0].media)?.name) }));
check(restyled.n === 2 && restyled.head1 === 'My real caption' && !restyled.sample1 && restyled.head0 && restyled.bg === 'horizon' && restyled.font === 10 && restyled.media.join() === built.lib.join(), 'Restyle keeps slides, media and real captions · ' + JSON.stringify(restyled));
// undo brings the previous set back
await page.evaluate(() => document.activeElement.blur());
await page.keyboard.press('Control+z'); await page.waitForTimeout(100);
check((await page.evaluate(() => project.slides[0].bgType)) === 'spotlight', 'undo reverts a restyle');
// with no screenshots the set builds its full layout list with placeholders
const empty = await page.evaluate(() => { const saved = media; media = media.filter(m => m.kind !== 'image'); const p = planSet(SET_TEMPLATES[0]); media = saved; return { n: p.slides.length, specs: SET_TEMPLATES[0].slides.length, placeholders: p.slides.every(s => s.phones.every(ph => !ph.media)) }; });
check(empty.n === empty.specs && empty.placeholders, 'without screenshots a set builds every layout with placeholders · ' + JSON.stringify(empty));

/* 14. background engine: every style and shape renders, looks apply and are highlighted */
const bgErrs = await page.evaluate(() => {
  const S = cur(), errs = [];
  for (const t of BG_TYPES) for (const sh of SHAPES) { S.bgType = t; S.shapes = sh; S.vignette = 0.2; try { render(); } catch (e) { errs.push(t + '/' + sh + ': ' + e.message); } }
  S.vignette = 0; return errs;
});
check(bgErrs.length === 0, 'all background styles × shapes render' + (bgErrs.length ? ': ' + bgErrs.join('; ') : ''));
await page.evaluate(() => openSection('bg'));
await page.click('#bgLooks .look:nth-child(6)'); await page.waitForTimeout(100);
const look = await page.evaluate(() => ({ type: cur().bgType, bg3: cur().bg3, grain: cur().grain, sel: [...document.querySelectorAll('#bgLooks .look')].findIndex(b => b.classList.contains('sel')), tiles: document.querySelectorAll('#bgLooks .look canvas').length, total: BG_LOOKS.length }));
check(look.type === 'aurora' && look.bg3 === '#a78bfa' && look.grain === 0.12 && look.sel === 5 && look.tiles === look.total, 'a look applies its full backdrop and is highlighted · ' + JSON.stringify(look));
// the seeded shapes land in the same relative spots at any size (preview == export)
const seedOk = await page.evaluate(() => {
  const S = { ...cur(), bgType: 'solid', bg1: '#000000', shapes: 'confetti', shapeColor: '#ffffff', shapeAlpha: 1, vignette: 0, grain: 0 };
  const px = (w, h) => { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const c = cv.getContext('2d'); drawBackdrop(c, w, h, S); const d = c.getImageData(0, 0, w, h).data; const on = []; for (let i = 0; i < d.length; i += 4) if (d[i] > 128) on.push(i / 4); return on; };
  const a = px(100, 217), b = px(200, 434);
  const scaled = new Set(b.map(i => (Math.floor(i / 200) >> 1) * 100 + ((i % 200) >> 1)));
  const hit = a.filter(i => scaled.has(i)).length;
  return { a: a.length, hit };
});
check(seedOk.a > 50 && seedOk.hit / seedOk.a > 0.9, 'seeded shapes are size-independent · ' + JSON.stringify(seedOk));

/* 15. export set pulls in screenshots that are on no slide */
await page.evaluate(() => { commitSet(planSet(SET_TEMPLATES[0]).slides, ''); deleteSlide(1); project.export.sizes = ['ip69']; project.export.scope = 'all'; project.export.layout = 'folders'; project.export.format = 'png'; project.export.includeUnused = true; });
await page.click('#exportSetBtn'); await page.waitForSelector('#exportDlg[open]');
const exUI = await page.evaluate(() => ({ row: !$('exUnusedRow').hidden, checked: $('exIncludeUnused').checked, text: $('exUnusedText').textContent, summary: $('exSummary').textContent, slides: project.slides.length, unused: unusedScreenshots().map(m => m.name) }));
check(exUI.row && exUI.checked && exUI.slides === 1 && exUI.unused.length === 1 && /2 slides × 1 size = 2 files/.test(exUI.summary), 'export dialog offers to add the unused screenshot · ' + JSON.stringify(exUI));
dl = page.waitForEvent('download', { timeout: 60000 }); await page.click('#exportSetGo'); d = await dl;
const zip3 = path.join(OUT, 'all-shots.zip'); await d.saveAs(zip3);
const l3 = execSync(`unzip -l "${zip3}"`).toString().split('\n').filter(l => /\.png$/.test(l));
const afterEx = await page.evaluate(() => ({ slides: project.slides.length, unused: unusedScreenshots().length, media: project.slides.map(s => mediaById(s.phones[0].media)?.name), strip: document.querySelectorAll('#slideStrip .slide').length }));
check(l3.length === 2 && afterEx.slides === 2 && afterEx.unused === 0 && afterEx.media.join() === 'shot1,shot2', 'export set added a slide for the unused screenshot and zipped both · ' + JSON.stringify({ files: l3.length, ...afterEx }));
// unticked: nothing is added
await page.evaluate(() => { deleteSlide(1); project.export.includeUnused = false; });
await page.click('#exportSetBtn'); await page.waitForSelector('#exportDlg[open]');
dl = page.waitForEvent('download', { timeout: 60000 }); await page.click('#exportSetGo'); d = await dl;
const zip4 = path.join(OUT, 'one-shot.zip'); await d.saveAs(zip4);
const l4 = execSync(`unzip -l "${zip4}"`).toString().split('\n').filter(l => /\.png$/.test(l));
check(l4.length === 1 && (await page.evaluate(() => project.slides.length)) === 1, 'with the option off the set is exported as is');
await page.evaluate(() => { project.export.includeUnused = true; });
// dropped screenshots fill placeholder slides in order
await page.evaluate(() => { const saved = media.filter(m => m.kind === 'image'); for (const m of saved) removeMedia(m.id); commitSet(planSet(SET_TEMPLATES[0]).slides, ''); });
const ph0 = await page.evaluate(() => ({ slides: project.slides.length, empty: project.slides.flatMap(s => s.phones).filter(p => !p.media).length }));
await page.setInputFiles('#fileInput', [`${ASSETS}/shot1.png`, `${ASSETS}/shot2.png`]);
await page.waitForFunction(() => screenshots().length === 2, null, { timeout: 15000 });
const filled = await page.evaluate(() => project.slides.slice(0, 3).map(s => s.phones.map(p => mediaById(p.media)?.name || '-').join('+')));
check(ph0.slides === 6 && ph0.empty >= 6 && filled[0] === 'shot1' && filled[1] === 'shot2' && filled[2].startsWith('-'), 'dropped screenshots fill the placeholder slides in order · ' + JSON.stringify({ ph0, filled }));

/* screenshots of the UI */
await page.evaluate(() => { selectSlide(0); project.preset = 'ip69'; syncAll(); render(); });
await page.waitForTimeout(300);
await page.screenshot({ path: path.join(OUT, 'ui.png') });

check(errors.length === 0, 'no console/page errors' + (errors.length ? ':\n   ' + errors.join('\n   ') : ''));
await browser.close();
console.log(failures ? `\n${failures} FAILURE(S)` : '\nALL E2E PASS');
process.exit(failures ? 1 : 0);
