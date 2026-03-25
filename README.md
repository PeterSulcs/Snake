# Snake

A small browser-based Snake game written in TypeScript.

## Features

- Arrow keys or WASD controls
- Mobile-friendly touch controls
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

## Controls

### Desktop

- Move: Arrow keys or WASD
- Restart after game over: Space
- Toggle wrap mode: button in the UI

### Mobile

Use the on-screen directional buttons.

## TODO:

- host it on github pages
