import * as THREE from 'three/webgpu'
import type { View, WalkControls } from './controls'
import type { Hallway } from './hallway'
import type { ShopRoom } from './shopRoom'
import type { Stage } from './stage'

/** How far into the doorway the camera walks before the scene changes, in metres from the lane centre. */
const DOORWAY_X = 3.3
const QUARTER_TURN = Math.PI / 2

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3)
const mix = (a: number, b: number, t: number) => a + (b - a) * t

/** Run `update` with 0..1 for `seconds`. */
function tween(seconds: number, update: (t: number) => void): Promise<void> {
  return new Promise((resolve) => {
    // The first frame's own timestamp is the start, so the two clocks cannot disagree.
    let start: number | undefined
    const frame = (now: number) => {
      start ??= now
      const t = Math.min((now - start) / (seconds * 1000), 1)
      update(t)
      if (t < 1) requestAnimationFrame(frame)
      else resolve()
    }
    requestAnimationFrame(frame)
  })
}

export interface Journey {
  /** The shop the camera is in, or null in the hall. */
  readonly shop: number | null
  enterShop: (shop: number, instant?: boolean) => Promise<void>
  exitShop: () => Promise<void>
}

/**
 * Taps and the moves between the hall and a shop: walk to the door, the doors
 * slide open, walk through, and the shop room appears.
 */
export function createJourney(
  stage: Stage,
  controls: WalkControls,
  hallway: Hallway,
  room: ShopRoom,
  ui: { fade: HTMLElement; back: HTMLButtonElement },
): Journey {
  const state = { shop: null as number | null }
  let busy = false

  const view = (): View => ({ yaw: controls.yaw, pitch: controls.pitch, z: controls.z, x: controls.x })
  const move = (from: View, to: Partial<View>, t: number) =>
    controls.set({
      yaw: mix(from.yaw, to.yaw ?? from.yaw, t),
      pitch: mix(from.pitch, to.pitch ?? from.pitch, t),
      z: mix(from.z, to.z ?? from.z, t),
      x: mix(from.x, to.x ?? from.x, t),
    })
  const fade = (opacity: number) => (ui.fade.style.opacity = String(opacity))

  const showRoom = (shop: number) => {
    room.setShop(hallway.shopSign(shop))
    hallway.group.visible = false
    room.group.visible = true
    ui.back.hidden = false
    state.shop = shop
  }
  const showHall = () => {
    room.group.visible = false
    hallway.group.visible = true
    ui.back.hidden = true
    state.shop = null
  }

  const enterShop = async (shop: number, instant = false) => {
    if (busy || state.shop !== null) return
    busy = true
    controls.setMode('cinematic')
    const { z, side } = hallway.shopPose(shop)

    if (!instant) {
      // 1. Walk to the shop and turn to face its door.
      const start = view()
      const facing = -side * QUARTER_TURN
      const distance = Math.abs(start.z - z)
      await tween(THREE.MathUtils.clamp(0.6 + distance * 0.09, 0.8, 2.4), (t) =>
        move(start, { z, x: 0, yaw: facing, pitch: 0 }, easeInOut(t)),
      )
      // 2. The doors slide open while the camera steps closer.
      const atLane = view()
      await tween(0.9, (t) => {
        hallway.setDoorOpen(shop, easeInOut(t))
        move(atLane, { x: side * 1.2 }, easeInOut(t))
      })
      // 3. Walk through the doorway; the light takes over the view.
      const atDoor = view()
      await tween(0.9, (t) => {
        move(atDoor, { x: side * DOORWAY_X }, t * t)
        fade(THREE.MathUtils.smoothstep(t, 0.35, 1))
      })
    }

    // 4. The shop room: come in from the door and stop at the centre.
    hallway.setDoorOpen(shop, 0)
    showRoom(shop)
    const inside: View = { x: room.center.x, z: room.entryZ, yaw: 0, pitch: 0 }
    controls.set(inside)
    if (!instant) {
      await tween(1.1, (t) => {
        move(inside, { z: room.center.z }, easeOut(t))
        fade(1 - THREE.MathUtils.smoothstep(t, 0, 0.6))
      })
    }
    controls.set({ ...inside, z: room.center.z })
    fade(0)
    controls.setMode('shop')
    busy = false
  }

  const exitShop = async () => {
    const shop = state.shop
    if (busy || shop === null) return
    busy = true
    controls.setMode('cinematic')
    const { z, side } = hallway.shopPose(shop)

    await tween(0.45, (t) => fade(t))
    showHall()
    hallway.setDoorOpen(shop, 1)
    // Back in the hall: step out of the doorway, then turn to face along the hall.
    const outside: View = { x: side * 1.6, z, yaw: side * QUARTER_TURN, pitch: 0 }
    controls.set(outside)
    await tween(1.4, (t) => {
      fade(1 - THREE.MathUtils.smoothstep(t, 0, 0.4))
      move(outside, { x: 0, yaw: 0 }, easeInOut(t))
      hallway.setDoorOpen(shop, 1 - easeInOut(THREE.MathUtils.smoothstep(t, 0.3, 1)))
    })
    fade(0)
    controls.set({ x: 0, z, yaw: 0, pitch: 0 })
    controls.setMode('hall')
    busy = false
  }

  // Taps: a shop front in the hall enters that shop; the door in a shop leaves it.
  const raycaster = new THREE.Raycaster()
  const pointer = new THREE.Vector2()
  controls.onTap = (x, y) => {
    if (busy) return
    const canvas = stage.renderer.domElement
    pointer.set((x / canvas.clientWidth) * 2 - 1, -(y / canvas.clientHeight) * 2 + 1)
    stage.camera.updateMatrixWorld()
    raycaster.setFromCamera(pointer, stage.camera)
    if (state.shop === null) {
      const hit = raycaster.intersectObjects(hallway.tapTargets, false)[0]
      const shop = hit ? hallway.shopAt(hit) : null
      if (shop !== null) void enterShop(shop)
    } else if (raycaster.intersectObjects(room.exitTargets, false).length > 0) {
      void exitShop()
    }
  }
  ui.back.addEventListener('click', () => void exitShop())
  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !document.fullscreenElement) void exitShop()
  })

  return Object.assign(state, { enterShop, exitShop })
}
