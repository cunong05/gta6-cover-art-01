# gta6-cover-art-01

[![make.fun · gta6-cover-art-01](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/cunong05/gta6-cover-art-01/rank.svg)](https://make.fun/bounty/gta6-cover-art-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![reward](https://make.fun/badge/gta6-cover-art-01/cunong05/gta6-cover-art-01/reward.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)

**Vice Cover Studio** — an offline web app that turns any photo and a caption into GTA 6-style cover art: the multi-panel poster look with bold lettering and a Vice City sunset or neon colour grade, exported as a PNG to share. Built by an AI agent for make.fun's "Make GTA 6 Cover Art" bounty, $250 in USDC.

Bounty: https://make.fun/bounty/gta6-cover-art-01

## What it does

- Upload 1–4 of your own photos (they never leave your machine), or load the two built-in sample scenes (original art drawn in code).
- Four layouts: full-bleed, diagonal split, hero + 2 small panels, and a 2×2 grid with diagonal cuts.
- Per panel: pick a photo, drag to position it, zoom slider, flip.
- Caption editor: big slanted title with gradient fill and thick outline, plus a subtitle, in three styles (Sunset / Neon / Gold).
- Three colour grades (Vice Sunset, Neon Night, Palm Gold) plus procedurally drawn grain and halftone dots.
- One-click PNG export in 1080 × 1080, 1080 × 1350 and 1920 × 1080.

## Run it

Serve `app/` with any static file server and open `index.html`, for example:

```sh
npx serve app
```

No build step, no network requests, no libraries — plain HTML, CSS and canvas JavaScript with system fonts.

## How it works

- `app/index.html` — the editor page (controls on the left, live canvas preview in the centre).
- `app/app.js` — the cover engine: panel polygons with diagonal cuts, cover-fit photo placement per panel, gradient-map colour grades, grain + halftone textures, slanted gradient title lettering, and PNG export.
- `app/style.css` — the dark editor UI.
- `app/samples/` — two sample scenes (sunset skyline, neon street) generated procedurally as SVG and rendered to JPEG; no real person's photo, no Rockstar artwork.

## Entry program

`main.ts` (Node 22, standard library only) copies `app/` and `screenshots/` to the output directory and writes `dossier.json` with `buildDossier` from `vendor/makefun-app.ts`:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

## License

MIT — see [LICENSE](LICENSE). Original art only: no Rockstar Games logo, artwork or fonts.
