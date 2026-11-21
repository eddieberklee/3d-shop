# 3d-shop

- Check before you report done: `npm run check` (typecheck and production build).
- Renderer setup is in `src/stage.ts`. Scene content goes on `stage.scene`; call `stage.invalidate()` after each change, because frames are drawn on demand.
- This repo is public. Do not commit `.env` files or secrets.
