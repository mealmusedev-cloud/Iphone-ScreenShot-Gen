/* Geometry test: renders each iPhone at native display resolution (1 canvas px = 1 display pixel)
   and measures the drawn body, display and Dynamic Island against Apple's dimensional drawings.
   Run: node tests/geometry.mjs   (needs playwright) */
import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const b = await chromium.launch(); const p = await b.newPage();
const errs=[]; p.on('pageerror',e=>errs.push(e.message));
await p.goto(pathToFileURL(path.join(ROOT, 'index.html')).href); await p.waitForTimeout(700);
const res = await p.evaluate(async () => {
  const out = {};
  for (const model of ['17pro', '17promax']) {
    const G = IPHONES[model];
    const k = G.displayPx[0] / (G.bodyW - 2 * G.displayInset);       // native: 1 canvas px = 1 display pixel
    const pad = 40, W = Math.ceil(G.bodyW * k) + 2 * pad, H = Math.ceil(G.bodyH * k) + 2 * pad;
    // solid magenta "screenshot"
    const src = document.createElement('canvas'); src.width = G.displayPx[0]; src.height = G.displayPx[1];
    const sc = src.getContext('2d'); sc.fillStyle = '#ff00ff'; sc.fillRect(0, 0, src.width, src.height);
    const img = new Image(); img.src = src.toDataURL(); await img.decode();
    media.push({ id: 'probe-' + model, name: 'probe', kind: 'image', el: img, w: src.width, h: src.height, url: img.src });
    const S = { ...defaultSlide(), shadowStr: 0, glare: false, model, phones: [{ media: 'probe-' + model, scale: 1, tilt: 0, x: 0, y: 0 }] };
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const c = cv.getContext('2d'); c.fillStyle = '#ffffff'; c.fillRect(0, 0, W, H);
    drawIphone(c, S, G, FRAMES.silver, pad, pad, k, false, 0, {});
    const d = c.getImageData(0, 0, W, H).data;
    const at = (x, y) => { const i = (y * W + x) * 4; return [d[i], d[i + 1], d[i + 2]]; };
    const isMag = ([r, g, bb]) => r >= 128 && g < 128 && bb >= 128;
    const isBlack = ([r, g, bb]) => r < 128 && bb < 128;
    const isWhite = ([r, g, bb]) => r + g + bb > 3 * 240;
    const cx = Math.round(W / 2), cy = Math.round(H / 2);
    // body extent along the centre row / column
    let bl = 0; while (isWhite(at(bl, cy))) bl++; let br = W - 1; while (isWhite(at(br, cy))) br--;
    let bt = 0; while (isWhite(at(cx + 300, bt))) bt++; let bb2 = H - 1; while (isWhite(at(cx + 300, bb2))) bb2--;
    // display extent (magenta) along the centre row and a column clear of the island
    let ml = 0; while (!isMag(at(ml, cy))) ml++; let mr = W - 1; while (!isMag(at(mr, cy))) mr--;
    const col = cx + Math.round(G.displayPx[0] * 0.3);
    let mt = 0; while (!isMag(at(col, mt))) mt++; let mb = H - 1; while (!isMag(at(col, mb))) mb--;
    // island: black run on the centre column below the display top, and its width on its centre row
    let it = mt; while (!isBlack(at(cx, it))) it++; let ib = it; while (isBlack(at(cx, ib))) ib++;
    const irow = Math.round((it + ib) / 2);
    let il = cx; while (isBlack(at(il, irow))) il--; let ir = cx; while (isBlack(at(ir, irow))) ir++;
    // display corner: inset of the magenta boundary along the 45° diagonal from the active-area corner
    let dg = 0; while (!isMag(at(ml + dg, mt + dg))) dg++;
    out[model] = { raw: { bodyW: br - bl + 1, bodyH: bb2 - bt + 1, expW: G.bodyW * k, expH: G.bodyH * k, dispW: mr - ml + 1, dispH: mb - mt + 1,
                          isW: ir - il - 1, isH: ib - it, isTop: it - mt, gapL: il + 1 - ml, gapR: mr - ir + 1, px: G.displayPx },
      'canvas px per mm': +k.toFixed(4),
      'body px (w×h)': `${br - bl + 1} × ${bb2 - bt + 1}`, 'body expected': `${(G.bodyW * k).toFixed(1)} × ${(G.bodyH * k).toFixed(1)}`,
      'display px (w×h)': `${mr - ml + 1} × ${mb - mt + 1}`, 'display expected': `${G.displayPx[0]} × ${G.displayPx[1]}`,
      'island px (w×h)': `${ir - il - 1} × ${ib - it}`, 'island top below display top px': it - mt,
      'island centred? (left gap vs right gap)': `${il + 1 - ml} vs ${mr - ir + 1}`,
      'display corner 45° inset px': dg,
      '62 pt continuous-corner circle equivalent 45° inset px': +((62 * 3) * (1 - Math.SQRT1_2)).toFixed(1),
    };
  }
  return out;
});
let failures = 0;
const check = (ok, msg) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg); if (!ok) failures++; };
for (const [model, r] of Object.entries(res)) {
  const g = r.raw;
  check(Math.abs(g.bodyW - g.expW) <= 1 && Math.abs(g.bodyH - g.expH) <= 1, `${model} body ${g.bodyW}×${g.bodyH} px ≈ ${g.expW.toFixed(1)}×${g.expH.toFixed(1)}`);
  check(g.dispW === g.px[0] && g.dispH === g.px[1], `${model} display ${g.dispW}×${g.dispH} px = ${g.px[0]}×${g.px[1]}`);
  check(g.isW === 376 && g.isH === 110, `${model} Dynamic Island ${g.isW}×${g.isH} px = 376×110 (125.33×36.67 pt)`);
  check(g.isTop === 42, `${model} island top ${g.isTop} px below the display = 42 (14 pt)`);
  check(Math.abs(g.gapL - g.gapR) <= 1, `${model} island centred (${g.gapL} vs ${g.gapR})`);
}
check(errs.length === 0, 'no page errors ' + errs.join('; '));
await b.close();
console.log(failures ? `\n${failures} FAILURE(S)` : '\nALL GEOMETRY PASS');
process.exit(failures ? 1 : 0);
