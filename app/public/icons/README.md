# App icons

`icon.svg` is the source of truth — a placeholder until a real logo lands.

iOS PWA installs and the manifest spec also want PNG variants:

- `icon-192.png` (192×192)
- `icon-512.png` (512×512)
- `icon-maskable-512.png` (512×512, full-bleed, safe zone inside the
  inner 80%)
- `apple-touch-icon.png` (180×180, referenced from layout metadata)

Generate from `icon.svg` with any tool — e.g.:

```
# macOS, with librsvg installed (brew install librsvg)
rsvg-convert -w 192 -h 192 icon.svg > icon-192.png
rsvg-convert -w 512 -h 512 icon.svg > icon-512.png
rsvg-convert -w 512 -h 512 icon.svg > icon-maskable-512.png
rsvg-convert -w 180 -h 180 icon.svg > ../apple-touch-icon.png
```

Until those PNGs exist, the manifest falls back to the SVG and iOS
will use a generic icon on the home screen.
