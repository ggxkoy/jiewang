# Messenger Geometry Clone

A lightweight Three.js recreation of [messenger.abeto.co](https://messenger.abeto.co/) with simple geometry instead of original art assets.

## Reference

- Original website: [https://messenger.abeto.co/](https://messenger.abeto.co/)

## What it includes

- Full-screen title scene with `MES / SEN / GER` and `BEGIN`
- Tiny spherical world rendered in Three.js
- Third-person character movement on a small planet
- Desktop and mobile controls
- Quest HUD in the top-right corner
- NPC interaction and multi-step delivery quests
- Visible parcel the character carries while a delivery is in progress
- On-screen compass that points toward the current objective NPC
- Collectible coins scattered across the planet with a saved counter
- Soft, warm Ghibli-style art direction: gradient sky, fluffy drifting clouds, smooth rolling planet, and soft shadows
- Rounded blob-foliage trees, scattered wildflower clusters, and petals drifting through the air
- Gently shimmering, undulating sea rings around the island
- Day/night cycle with a moving sun, moon, stars, and a warm sunrise/sunset glow along the horizon
- Procedural ambient music and interaction chimes via the Web Audio API
- Reset progress, music toggle, day/night toggle, outfit swap, and recenter camera actions

## Controls

- `WASD` or arrow keys: move
- `Shift`: sprint
- `Space`: jump
- `E`: talk to the nearest NPC
- Walk over a coin to collect it automatically

## Local development

```bash
npm install
npm run dev
```

Open:

```text
http://localhost:3000
```

## Tech

- Node.js
- Express
- Three.js

## Rendering pipeline

The scene renders through a small Ghibli-style toon pipeline so that both the
built-in primitives and any models you upload share one look:

- `public/shading.js`: converts `MeshStandardMaterial` to `MeshToonMaterial`
  with a shared gradient ramp, injects a soft fresnel rim light, and builds
  inverted-hull outlines.
- `public/postfx.js`: `EffectComposer` chain — render → gentle bloom →
  tone-mapping/sRGB output. Falls back to a direct render if it fails to init.
- `public/models.js`: GLTF loading pipeline (DRACO + Meshopt decoders) that
  auto-applies toon shading, shadows, outlines, surface placement, and
  animation. Reads `models/manifest.json` on startup.

An import map in `index.html` maps `three` and `three/addons/` to the vendored
Three.js build, so modules use bare specifiers.

## Uploading models

Drop `.glb`/`.gltf` files into `models/` and register them in
`models/manifest.json` — no code changes needed. See `models/README.md` for the
manifest schema. `models/demo-crate.gltf` is a sample that proves the pipeline;
remove its manifest entry once you add your own.

## Project files

- `public/index.html`: UI shell and Three.js import map
- `public/styles.css`: HUD and overlay styles
- `public/app.js`: world setup, player controls, camera, quests, and NPC logic
- `public/shading.js`: toon material conversion, rim light, and outlines
- `public/postfx.js`: post-processing (bloom + output) composer
- `public/models.js`: GLTF model loading and manifest pipeline
- `server.mjs`: static server, Three.js module exposure, and `/models` route

## Notes

- The project intentionally replaces original art with primitive geometry.
- Quest progress and collected coins are stored in `localStorage`.
- Ambient music is generated procedurally at runtime, so no audio asset files are bundled.
- The current build is a static local web app with no backend save service.
