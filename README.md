# App Store Screenshot Studio

## ▶ [Open the app](https://mealmusedev-cloud.github.io/Iphone-ScreenShot-Gen/)

Click the link above. It runs right in your browser with nothing to install:
no Python, no Node, no server. Clicking `index.html` in this repository only
shows its code, because GitHub never runs HTML files. Use the link instead.

To use it offline, press **⤓ Download for offline** in the app's top bar and
double-click the downloaded file.

A single self-contained HTML page for producing App Store Connect screenshots
and app preview videos. Drop in screen recordings or screenshots, frame them in a
realistic iPhone or iPad, caption and style them, and export a complete,
upload-ready set at exact App Store pixel sizes.

No build step, no dependencies, no upload. Everything runs locally in the
browser and your media never leaves your machine.

## Use it

**Live site:** https://mealmusedev-cloud.github.io/Iphone-ScreenShot-Gen/

The app *is* the website: `index.html` at the repository root. Every push to
`main` deploys it to GitHub Pages through `.github/workflows/pages.yml`.
One-time setup in the repository: **Settings → Pages → Build and deployment →
Source: GitHub Actions**.

To use it offline, download `index.html` and double-click it. It runs straight
from your disk with nothing to install: no Python, no Node, no server. Every
feature works that way, including saved media, PNG/ZIP export and MP4 previews.

Chrome, Edge or Safari on macOS is recommended: those encode app previews
directly to upload-ready H.264 + AAC MP4 files. The site is installable as a
standalone app (web manifest included).

## What it produces

**Screenshots**
- Flattened 8-bit RGB PNG with no alpha channel (what App Store Connect wants),
  or JPEG.
- Pixel-exact at every App Store Connect size, with the required ones marked:
  iPhone 6.9″ (1320×2868 / 1290×2796), 6.5″, 6.3″, 6.1″, 5.5″, 4.7″, their
  landscape variants, iPad 13″ (2064×2752 / 2048×2732), 12.9″, 11″, 10.5″, 9.7″
  and iPad landscape.
- "Export set" renders every slide at every size you tick into one `.zip`,
  either one folder per device size or the flat per-locale layout that
  `fastlane deliver` expects (`en-US/01_iPhone-6.9_headline.png`).

**App previews**
- Exact preview sizes: 886×1920 and 1920×886 (iPhone), 1080×1920 (5.5″),
  1200×1600 and 1600×1200 (iPad).
- Frame-exact 30 fps H.264 with AAC audio in a faststart MP4 with correct
  duration metadata, encoded in the browser with WebCodecs. Length is held to
  Apple's 15–30 s window and short clips can loop to reach 15 s.
- Browsers without WebCodecs H.264 fall back to a screen recording and the app
  hands you the ffmpeg command that fixes it up.

## Editing

- **Slides**: up to 10 per set (App Store Connect's limit). Each slide keeps its
  own headline, devices and look. Add, duplicate, delete and drag to reorder in
  the strip above the canvas. "Apply this style to all slides" copies one look
  across the set.
- **Direct manipulation**: drag devices and the text block on the canvas,
  scroll over a device to resize it, ⌥+scroll to tilt, double-click to replace
  its media. Arrow keys nudge the selected device.
- **Devices**: up to 3 per slide, titanium/black/silver/gold/blue rails,
  Dynamic Island, side buttons, glossy bezel, layered shadows, glare, glow.
- **Backgrounds**: linear, radial, aurora and mesh gradients, solid colour,
  backdrop shapes (circles, rings, dots, grid, waves), film grain, vignette.
- **Text**: separate font, weight, size, colour, italic, caps and letter spacing
  for headline and subheadline (22 font stacks), free positioning, alignment,
  text width, line height, shadow, plus a badge pill and a star-rating row.
- **Style presets**: 16 one-click looks.
- **Undo/redo** (⌘Z / ⌘⇧Z), ⌘E export PNG, ⌘⇧E export set, ⌘D duplicate slide,
  ⌘S save project, `[` `]` switch slides.
- **Persistence**: the project autosaves, and media is kept in the browser's
  IndexedDB so a reload brings everything back. Save/load the project as JSON
  to move it between machines (re-add the media files there).
- **Readiness check**: a checklist that flags placeholder screens, missing
  required sizes, sample copy, low-resolution captures, preview length and
  device frames on previews before you upload.

## App Store Connect notes

- Only the iPhone 6.9″ and iPad 13″ sizes are required; App Store Connect
  scales them to every other display. Export the others only if you want to
  tailor them.
- App previews must show the app as captured on device. Apple rejects previews
  that show device hardware, so turn on **Fill frame** for the preview itself
  and keep the framed renders for your website, social posts and press.
- Device frames in screenshots are fine and widely used.
- Previews: 15–30 seconds, H.264, 30 fps, up to 500 MB, up to 3 per device.

## Development

The page has no dependencies. The export helpers (RGB PNG encoder, ZIP writer,
MP4 muxer) live between `/*LIB-START*/` and `/*LIB-END*/` in the script so they
can be extracted and unit-tested in Node against ffprobe, and the same block is
loaded into a Web Worker so PNG encoding never blocks the UI.
