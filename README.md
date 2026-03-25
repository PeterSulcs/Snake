# Snake

A small browser-based Snake game written in TypeScript.

## Features

- Arrow keys or WASD controls
- Mobile-friendly compact touch controls
- Haptic feedback on supported mobile browsers, with clearer in-game messaging when iPhone/iPad web haptics are limited or unavailable
- Optional wrap-around walls mode
- Persistent best score via localStorage
- Increasing speed as you eat food

## Run it locally

```bash
npm install
npm run build
npm start
```

Then open <http://localhost:4173>.

## Publish to GitHub Pages

1. Push this repo to GitHub.
2. In the GitHub repo, open **Settings → Pages**.
3. Under **Build and deployment**, set **Source** to **GitHub Actions**.
4. Push to `main` (or run the workflow manually).

The included workflow will build the game and deploy it to GitHub Pages automatically.

Live site: <https://petersulcs.github.io/Snake/>

## Controls

### Desktop

- Move: Arrow keys or WASD
- Restart after game over: Space
- Toggle wrap mode: button in the UI

### Mobile

Use the on-screen directional buttons.

