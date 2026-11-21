# 3d-shop

A web app that is one full-screen, physically based 3D scene. The scene is empty for now.

## Stack

- [three.js](https://threejs.org) `WebGPURenderer`: WebGPU where the browser has it, WebGL 2 otherwise.
- Vite and TypeScript. No UI framework.
- Rendering is on demand: a frame is drawn only when something changes.

## Commands

- `npm install`
- `npm run dev`: development server.
- `npm run check`: typecheck and production build.

Add `?webgl` to the URL to force the WebGL 2 backend. The active backend is in `document.documentElement.dataset.backend`.

## License

MIT. Copy, change, and use it for any purpose, including commercial use. See [LICENSE](LICENSE).
