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

## Project files

- `public/index.html`: UI shell
- `public/styles.css`: HUD and overlay styles
- `public/app.js`: world setup, player controls, camera, quests, and NPC logic
- `server.mjs`: static server and local Three.js module exposure

## Notes

- The project intentionally replaces original art with primitive geometry.
- Quest progress and collected coins are stored in `localStorage`.
- Ambient music is generated procedurally at runtime, so no audio asset files are bundled.
- The current build is a static local web app with no backend save service.
