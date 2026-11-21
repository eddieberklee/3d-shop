# 3d-shop

A web app that is one full-screen, physically based 3D scene: an open-air mall walk in a Japandi style (plaster, pale oak, stone pavers, open sky) with a shop in each bay.

## Controls

- Swipe left or right: look around (limit 75° each side; one full-width swipe turns 150°).
- Swipe up or down while turned: look up or down (you cannot look straight down).
- Swipe down while you face along the hall: walk forward. Swipe up: walk back.
- Full screen: the corner button or `F` (desktop, Android, iPad). On iPhone, use Share → Add to Home Screen.
- Desktop: drag, scroll wheel, or `W` `A` `S` `D` and the arrow keys.

## Stack

- [three.js](https://threejs.org) `WebGPURenderer`: WebGPU where the browser has it, WebGL 2 otherwise.
- Vite and TypeScript. No UI framework.
- Rendering is on demand, plus a 30 fps redraw for the cloud drift. A hidden tab draws nothing.

## Shop data

`src/shop.ts` calls [Shop MCP](https://shop.dev/docs/index.md) (`https://mcp.shop.com/`) directly from the browser. No account or API key is necessary.

- `searchCatalog`, `lookupCatalog`, `getProduct`: products, prices, images and sellers from all Shopify merchants.
- `createCheckout`, `getCheckout`: a real checkout at one merchant. The shopper pays on its `continue_url`.

`.mcp.json` registers the same server for coding agents.

## Commands

- `npm install`
- `npm run dev`: development server.
- `npm run check`: typecheck and production build.

Add `?webgl` to the URL to force the WebGL 2 backend. The active backend is in `document.documentElement.dataset.backend`.

## License

MIT. Copy, change, and use it for any purpose, including commercial use. See [LICENSE](LICENSE).
