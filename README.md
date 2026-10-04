# App Store Screenshot Studio

A single self-contained HTML page for building App Store Connect screenshots and
app preview videos. Drop in a screen recording or screenshot, frame it in a
realistic iPhone/iPad, style it, and export at exact App Store pixel sizes.

No build step, no dependencies, no upload — everything runs locally in the browser
and your media never leaves your machine.

## Use it

Open `iphone-mockup.html` in a browser, or serve the folder:

```bash
python3 -m http.server 8899
# then open http://localhost:8899/iphone-mockup.html
```

Chrome is recommended: it records app previews directly as H.264 MP4.

## Features

**Devices and export sizes**
- iPhone 6.9" (1320x2868, 1290x2796), 6.5" (1242x2688), landscape (2868x1320)
- iPad 13" (2064x2752) and 12.9" (2048x2732), plus iPad landscape (2752x2064)
- App preview video: 886x1920 portrait and 1920x886 landscape
- Exports are pixel-exact, named `<name>-<width>x<height>.png`

**Composition**
- Up to 3 devices per image, each with its own media, size, tilt and position
- Realistic frames: titanium/black/silver/gold rails, antenna breaks, Dynamic
  Island with camera, glossy bezel, side buttons, dual-layer shadows
- Backgrounds: linear/radial gradients, aurora blobs, solid, plus backdrop
  shapes (circles, rings, dot grid), film grain and a glow halo
- Screen glare, adjustable shadow strength

**Text**
- Separate font, weight, size, color, italic, caps and letter spacing for the
  headline and subheadline (22 font stacks)
- Free X/Y positioning, alignment, line height, text shadow
- Badge pill and a star-rating row for social proof

**Video**
- Drop in MP4/MOV; it plays live inside the device frame
- Records the composed canvas (frame, background, text and all) with the
  source video's audio, capped at the App Store's 30s limit
- "Fill frame" mode renders the video full-bleed with no device frame

**Presets and persistence**
- 15 one-click style presets
- Save/load settings as JSON; settings also autosave between sessions

## Two notes for App Store uploads

**1. Always run the ffmpeg fix-up on recorded video.** Browser `MediaRecorder`
output carries broken duration metadata, which App Store Connect rejects. The
app has a button that copies this command with the current dimensions filled in:

```bash
ffmpeg -i input.mp4 -vf "scale=886:1920,fps=30" -c:v libx264 -profile:v high \
  -pix_fmt yuv420p -movflags +faststart -c:a aac -b:a 128k output.mov
```

**2. Apple does not allow device frames in app previews.** App previews must be
captured from the device screen; showing iPhone hardware around your app usually
gets rejected. Use "Fill frame (no device)" for the App Store video itself, and
keep the framed look for your website, social posts and press.

Device frames in *screenshots* are fine and widely used.
