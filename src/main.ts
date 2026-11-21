import './style.css'
import { Vector3 } from 'three/webgpu'
import { createWalkControls } from './controls'
import { buildHallway } from './hallway'
import { createJourney } from './journey'
import { SHOPS } from './shopList'
import { orderShopsByModels } from './shopOrder'
import { createShelfCubes } from './shelfCubes'
import { buildShopRoom } from './shopRoom'
import { createStage } from './stage'
import { openTryOn, restoreTryOn } from './tryOn'
import { recordProductClick } from './clicks'

const canvas = document.querySelector<HTMLCanvasElement>('#stage')!
const stage = await createStage(canvas)

// The active backend, readable from devtools and tests.
document.documentElement.dataset.backend = stage.backend

stage.camera.fov = 65
stage.camera.updateProjectionMatrix()

const hallway = buildHallway(stage)
const controls = createWalkControls(canvas, stage.camera, stage.invalidate, hallway)
// The shop room stands where the hall is; only one of the two is visible at a time.
const room = buildShopRoom(stage, new Vector3(0, 0, (hallway.zStart + hallway.zEnd) / 2))
const journey = createJourney(stage, controls, hallway, room, {
  fade: document.querySelector<HTMLElement>('#fade')!,
  back: document.querySelector<HTMLButtonElement>('#back')!,
})

// Placeholder product cubes on the shop's shelf. A tap on one opens the try-on panel.
const cubes = createShelfCubes(stage, room)
// The page can load again while the shopper is in a shop (a phone that comes
// back from its camera, or a new version of the page). The shop and the try-on
// panel are kept for this tab, so the shopper comes back to the same place.
const SHOP_KEY = 'shop'
const remember = (shop: number | null) => {
  try {
    if (shop === null) sessionStorage.removeItem(SHOP_KEY)
    else sessionStorage.setItem(SHOP_KEY, String(shop))
  } catch {
    // No storage (private mode): the shopper starts in the hall after a reload.
  }
}
room.onEnter = (shop) => {
  remember(shop)
  cubes.setShop(shop)
}
room.onLeave = () => remember(null)
const journeyTap = controls.onTap
controls.onTap = (x, y) => {
  const product = journey.shop === null ? null : cubes.productAt(x, y)
  if (!product) return journeyTap?.(x, y)
  recordProductClick(product.id)
  openTryOn(product)
}

// Full screen: a button and the F key where the browser has the Fullscreen API
// (desktop, Android, iPad). Esc leaves it. iPhone Safari has no such API: there,
// "Add to Home Screen" opens the app with no browser bars.
// Real shops, in a fixed order. Each name goes up at once; each logo is found
// live on the shop's own site and added when it loads.
// The shops with the most generated 3D models stand nearest the start.
await orderShopsByModels()
SHOPS.slice(0, hallway.shopCount).forEach((shop, index) => {
  hallway.setStorefront(index, shop.title)
  fetch(`/api/shop-logo?url=${encodeURIComponent(shop.url)}`)
    .then((response) => response.json())
    .then(({ url }: { url: string | null }) => url && hallway.setStorefront(index, shop.title, url))
    .catch(() => {})
})

const rememberedShop = (() => {
  try {
    const value = sessionStorage.getItem(SHOP_KEY)
    return value === null ? null : Number(value)
  } catch {
    return null
  }
})()
if (rememberedShop !== null && rememberedShop >= 0 && rememberedShop < hallway.shopCount && !location.search.includes('shop=')) {
  await journey.enterShop(rememberedShop, true)
  restoreTryOn()
}

if (document.fullscreenEnabled) {
  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen()
    else void document.documentElement.requestFullscreen({ navigationUI: 'hide' })
  }
  const button = document.querySelector<HTMLButtonElement>('#fullscreen')!
  button.hidden = false
  button.addEventListener('click', toggleFullscreen)
  window.addEventListener('keydown', (event) => {
    if (event.key.toLowerCase() === 'f' && !event.metaKey && !event.ctrlKey) toggleFullscreen()
  })
}

if (import.meta.env.DEV) {
  Object.assign(window, { stage, hallway, controls, room, journey })
  // `?view=z,yawDegrees,pitchDegrees` opens the page at that view, for visual checks.
  const view = new URLSearchParams(location.search).get('view')?.split(',').map(Number)
  if (view?.length === 3 && view.every(Number.isFinite)) {
    controls.set({ z: view[0], yaw: (view[1] * Math.PI) / 180, pitch: (view[2] * Math.PI) / 180 })
  }
  // `?shop=7` opens the page inside that shop; `&yaw=90` turns the view there.
  const params = new URLSearchParams(location.search)
  if (params.has('shop')) {
    await journey.enterShop(Number(params.get('shop')), true)
    controls.set({ yaw: (Number(params.get('yaw') ?? 0) * Math.PI) / 180 })
  }
  // `?tap=x,y` sends a tap at that screen position, to check the full animation.
  const tap = params.get('tap')?.split(',').map(Number)
  if (tap?.length === 2) controls.onTap?.(tap[0], tap[1])
  // `?door=7,0.6` slides that shop's doors, to check the door animation.
  const door = params.get('door')?.split(',').map(Number)
  if (door?.length === 2) hallway.setDoorOpen(door[0], door[1])
}
