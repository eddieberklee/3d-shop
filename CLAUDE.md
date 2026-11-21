# 3d-shop

- Check before you report done: `npm run check` (typecheck and production build).
- Renderer setup is in `src/stage.ts`. Scene content goes on `stage.scene`; call `stage.invalidate()` after each change, because frames are drawn on demand (the cloud drift in `src/hallway.ts` also redraws at 30 fps while the tab is visible).
- This repo is public. Do not commit `.env` files or secrets.
- Shop data comes from `src/shop.ts` (Shop MCP at `https://mcp.shop.com/`, no key). Fetch live data, keep every returned URL unchanged, and send the shopper to `continue_url` to pay. Checkouts are real: do not pay one in a test.
- Scene: `src/hallway.ts` builds the hall; `setStorefrontImage(shop, url)` puts an image on a shop front. `src/controls.ts` owns the camera (look limits, drag-the-lane-floor to walk, easing and momentum).
- Shops: `src/journey.ts` runs the tap, enter and exit animation; `src/shopRoom.ts` builds the one shared shop room. Control modes are `hall`, `shop` and `cinematic` (`src/controls.ts`).
- Dev-only URL parameters for visual checks: `?view=z,yaw,pitch`, `?shop=7&yaw=90`, `?door=7,0.6`, `?tap=x,y`.
