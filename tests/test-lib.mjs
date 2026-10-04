/* Unit tests for the export helpers embedded in index.html.
   Needs Node 18+ and ffmpeg/ffprobe on PATH:  node tests/test-lib.mjs */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const ASSETS = path.join(HERE, '.out', 'assets'); fs.mkdirSync(ASSETS, { recursive: true });
execSync(`ffmpeg -hide_banner -loglevel error -y -f lavfi -i "testsrc2=size=886x1920:rate=30:duration=3" -c:v libx264 -profile:v high -x264-params bframes=0:keyint=30 -pix_fmt yuv420p "${ASSETS}/ref.mp4"`);
execSync(`ffmpeg -hide_banner -loglevel error -y -f lavfi -i "sine=frequency=440:duration=3:sample_rate=48000" -ac 2 -c:a aac -b:a 128k -f adts "${ASSETS}/ref.aac"`);

const src = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const libSrc = src.slice(src.indexOf('/*LIB-START*/'), src.indexOf('/*LIB-END*/'));
const Bin = new Function(libSrc + '\nreturn Bin;')();

const out = path.join(HERE, '.out'); fs.mkdirSync(out, { recursive: true });
let failures = 0;
const check = (ok, msg) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg); if (!ok) failures++; };

/* ---------- CRC32 ---------- */
check(Bin.crc32(new TextEncoder().encode('123456789')) === 0xCBF43926, 'crc32 check value');

/* ---------- PNG ---------- */
{
  const w = 300, h = 200, rgba = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4; rgba[i] = x & 255; rgba[i + 1] = y & 255; rgba[i + 2] = (x * y) & 255; rgba[i + 3] = 255;
  }
  const png = await Bin.encodePngRgb(rgba, w, h);
  fs.writeFileSync(`${out}/t.png`, png);
  const probe = execSync(`ffprobe -v error -select_streams v:0 -show_entries stream=width,height,pix_fmt -of csv=p=0 ${out}/t.png`).toString().trim();
  check(probe === `${w},${h},rgb24`, 'png decodes as rgb24 ' + probe);
  execSync(`ffmpeg -v error -y -i ${out}/t.png -f rawvideo -pix_fmt rgb24 ${out}/t.raw`);
  const raw = fs.readFileSync(`${out}/t.raw`); let same = raw.length === w * h * 3;
  for (let p = 0; same && p < w * h; p++) if (raw[p * 3] !== rgba[p * 4] || raw[p * 3 + 1] !== rgba[p * 4 + 1] || raw[p * 3 + 2] !== rgba[p * 4 + 2]) same = false;
  check(same, 'png pixels round-trip exactly');
  console.log('  png size', png.length, 'bytes for', w * h * 3, 'raw');
}

/* ---------- ZIP ---------- */
{
  const zip = Bin.zipStore([
    { name: 'en-US/01-hello.txt', data: new TextEncoder().encode('hello zip') },
    { name: 'iPhone 6.9in/02-ünïcode.bin', data: new Uint8Array([1, 2, 3, 4, 5]) },
  ]);
  fs.writeFileSync(`${out}/t.zip`, zip);
  const t = execSync(`unzip -t ${out}/t.zip`).toString();
  check(/No errors detected/.test(t), 'zip passes unzip -t');
  const l = execSync(`unzip -l ${out}/t.zip`).toString();
  check(l.includes('en-US/01-hello.txt') && l.includes('ünïcode'), 'zip entry names incl. utf-8');
}

/* ---------- MP4 muxer: pull real H.264 samples out of an ffmpeg-made file ---------- */
function parseBoxes(buf, start, end, path, found) {
  let o = start;
  while (o + 8 <= end) {
    let size = buf.readUInt32BE(o); const type = buf.toString('latin1', o + 4, o + 8); let hdr = 8;
    if (size === 1) { size = Number(buf.readBigUInt64BE(o + 8)); hdr = 16; }
    if (size === 0) size = end - o;
    const p = path + '/' + type;
    found[p] = { o: o + hdr, e: o + size };
    if (['moov', 'trak', 'mdia', 'minf', 'stbl'].includes(type)) parseBoxes(buf, o + hdr, o + size, p, found);
    if (type === 'stsd') parseBoxes(buf, o + hdr + 8, o + size, p, found);
    if (type === 'avc1') parseBoxes(buf, o + hdr + 78, o + size, p, found);
    o += size;
  }
}
function extractVideo(file) {
  const buf = fs.readFileSync(file), f = {};
  parseBoxes(buf, 0, buf.length, '', f);
  const avcC = f['/moov/trak/mdia/minf/stbl/stsd/avc1/avcC'];
  const description = new Uint8Array(buf.subarray(avcC.o, avcC.e));
  const rd = k => { const b = f['/moov/trak/mdia/minf/stbl/' + k]; return { buf, o: b.o + 4 }; }; // skip version/flags
  const stsz = rd('stsz'); const sampleSize = buf.readUInt32BE(stsz.o), count = buf.readUInt32BE(stsz.o + 4);
  const sizes = []; for (let i = 0; i < count; i++) sizes.push(sampleSize || buf.readUInt32BE(stsz.o + 8 + 4 * i));
  const stco = rd('stco'); const nC = buf.readUInt32BE(stco.o); const offs = []; for (let i = 0; i < nC; i++) offs.push(buf.readUInt32BE(stco.o + 4 + 4 * i));
  const stsc = rd('stsc'); const nE = buf.readUInt32BE(stsc.o); const ents = []; for (let i = 0; i < nE; i++) ents.push({ first: buf.readUInt32BE(stsc.o + 4 + 12 * i), n: buf.readUInt32BE(stsc.o + 8 + 12 * i) });
  const stss = rd('stss'); const nK = buf.readUInt32BE(stss.o); const keys = new Set(); for (let i = 0; i < nK; i++) keys.add(buf.readUInt32BE(stss.o + 4 + 4 * i));
  const stsd = f['/moov/trak/mdia/minf/stbl/stsd/avc1']; const width = buf.readUInt16BE(stsd.o + 24), height = buf.readUInt16BE(stsd.o + 26);
  const samples = []; let si = 0;
  for (let c = 0; c < nC; c++) {
    let n = ents[0].n; for (const e of ents) if (e.first <= c + 1) n = e.n;
    let at = offs[c];
    for (let k = 0; k < n && si < count; k++, si++) { samples.push({ data: new Uint8Array(buf.subarray(at, at + sizes[si])), key: keys.has(si + 1), duration: 1000 }); at += sizes[si]; }
  }
  return { width, height, timescale: 30000, samples, description };
}
function extractAdts(file) {
  const buf = fs.readFileSync(file); const samples = []; let o = 0;
  while (o + 7 <= buf.length) {
    const protAbsent = buf[o + 1] & 1, len = ((buf[o + 3] & 3) << 11) | (buf[o + 4] << 3) | (buf[o + 5] >> 5), hdr = protAbsent ? 7 : 9;
    samples.push({ data: new Uint8Array(buf.subarray(o + hdr, o + len)), duration: 1024 }); o += len;
  }
  return samples;
}
{
  const video = extractVideo(`${ASSETS}/ref.mp4`);
  console.log('  video samples', video.samples.length, 'keys', video.samples.filter(s => s.key).length, 'avcC', video.description.length, 'bytes');
  const audio = { sampleRate: 48000, channels: 2, samples: extractAdts(`${ASSETS}/ref.aac`), description: Bin.aacAudioSpecificConfig(48000, 2) };
  console.log('  audio samples', audio.samples.length);
  const mp4 = Bin.muxMp4({ video, audio });
  fs.writeFileSync(`${out}/muxed.mp4`, mp4);
  const probe = execSync(`ffprobe -v error -show_entries format=duration:stream=codec_name,width,height,r_frame_rate,nb_frames,sample_rate,channels,profile -of json ${out}/muxed.mp4`).toString();
  const j = JSON.parse(probe); console.log('  ', JSON.stringify(j));
  const v = j.streams.find(s => s.codec_name === 'h264'), a = j.streams.find(s => s.codec_name === 'aac');
  check(v && v.width === 886 && v.height === 1920 && v.r_frame_rate === '30/1' && +v.nb_frames === video.samples.length, 'muxed video stream metadata');
  check(a && +a.sample_rate === 48000 && a.channels === 2, 'muxed audio stream metadata');
  check(Math.abs(+j.format.duration - 3) < 0.05, 'container duration ≈ 3 s (' + j.format.duration + ')');
  const errs = execSync(`ffmpeg -v error -i ${out}/muxed.mp4 -f null - 2>&1 || true`).toString().trim();
  check(errs === '', 'full decode without errors' + (errs ? ': ' + errs.slice(0, 200) : ''));
  const md5a = execSync(`ffmpeg -v error -i ${ASSETS}/ref.mp4 -f framemd5 - | grep -v '^#'`).toString();
  const md5b = execSync(`ffmpeg -v error -i ${out}/muxed.mp4 -map 0:v -f framemd5 - | grep -v '^#'`).toString();
  check(md5a === md5b, 'remuxed frames are bit-identical to the reference');
  // faststart: moov must come before mdat
  const s = mp4.subarray(0, 64 * 1024); const txt = Buffer.from(s).toString('latin1');
  check(txt.indexOf('moov') > 0 && txt.indexOf('moov') < txt.indexOf('mdat'), 'moov precedes mdat (faststart)');
  // video-only variant
  const mp4v = Bin.muxMp4({ video, audio: null }); fs.writeFileSync(`${out}/muxed-v.mp4`, mp4v);
  const e2 = execSync(`ffmpeg -v error -i ${out}/muxed-v.mp4 -f null - 2>&1 || true`).toString().trim();
  check(e2 === '', 'video-only mux decodes');
}
console.log(failures ? `\n${failures} FAILURE(S)` : '\nALL PASS');
process.exit(failures ? 1 : 0);
