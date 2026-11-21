import * as THREE from 'three/webgpu'
import {
  DOOR_HEIGHT,
  DOOR_PANEL_WIDTH,
  type ShopSign,
  canvasTexture,
  drawSign,
  oakTexture,
  shojiTexture,
} from './hallway'
import type { Stage } from './stage'

/** Metres. The room is square; the camera stands at its centre. */
const SIZE = 9
const HEIGHT = 3.8
const SKYLIGHT = 3.6

export interface ShopRoom {
  group: THREE.Group
  /** The room's centre on the floor. */
  center: THREE.Vector3
  /** Where the camera comes in: just inside the door, on the +z wall. */
  entryZ: number
  /** Tap targets that leave the shop (the door). */
  exitTargets: THREE.Object3D[]
  /** Show which shop this room is. */
  setShop: (sign: ShopSign) => void
}

/** A wall display: a title over empty oak shelves. Products go here later. */
function displayTexture(title: string, note: string, sign?: ShopSign): THREE.CanvasTexture {
  return canvasTexture(1024, 512, (g) => {
    g.fillStyle = '#e4dccd'
    g.fillRect(0, 0, 1024, 512)
    if (sign) {
      // The shop's own sign: logo above its name.
      drawSign(g, sign, 512, 14, 190, 820)
    } else {
      g.fillStyle = '#2b2925'
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      g.font = '300 54px "Helvetica Neue", system-ui, sans-serif'
      g.letterSpacing = '12px'
      g.fillText(title, 512, 70)
      g.font = '300 24px "Helvetica Neue", system-ui, sans-serif'
      g.letterSpacing = '4px'
      g.fillStyle = 'rgba(43,41,37,0.55)'
      g.fillText(note, 512, 124)
      g.letterSpacing = '0px'
    }
    for (let row = 0; row < 3; row++) {
      const y = 250 + row * 105
      g.fillStyle = '#a97f52'
      g.fillRect(70, y, 884, 12)
      g.fillStyle = 'rgba(43,41,37,0.10)'
      g.fillRect(70, y + 12, 884, 8)
    }
  })
}

export function buildShopRoom({ scene }: Stage, center: THREE.Vector3): ShopRoom {
  const room = new THREE.Group()
  room.name = 'shop-room'
  room.position.copy(center)
  room.visible = false
  scene.add(room)

  const half = SIZE / 2
  const plaster = new THREE.MeshStandardMaterial({ color: 0xebe3d5, roughness: 0.95 })
  const oakMap = oakTexture()
  oakMap.rotation = Math.PI / 2
  oakMap.repeat.set(6, 2)
  const oak = new THREE.MeshStandardMaterial({ map: oakMap, roughness: 0.5 })
  const trim = new THREE.MeshStandardMaterial({ map: oakTexture(), roughness: 0.55 })

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(SIZE, SIZE), oak)
  floor.rotation.x = -Math.PI / 2
  floor.receiveShadow = true
  room.add(floor)

  // Four walls. Each wall's inner face is at the room edge.
  const wallGeometry = new THREE.BoxGeometry(SIZE + 0.6, HEIGHT, 0.3)
  const displays: { title: string; note: string }[] = [
    { title: 'NEW IN', note: 'BACK WALL' },
    { title: 'SHELVES', note: 'RIGHT WALL' },
    { title: 'EXIT', note: 'TAP THE DOOR' },
    { title: 'TRY ON', note: 'LEFT WALL' },
  ]
  const titlePanels: THREE.MeshStandardMaterial[] = []
  const exitTargets: THREE.Object3D[] = []
  displays.forEach((display, i) => {
    // i: 0 back (-z), 1 right (+x), 2 door wall (+z), 3 left (-x).
    const wall = new THREE.Group()
    wall.rotation.y = (-i * Math.PI) / 2
    room.add(wall)

    const body = new THREE.Mesh(wallGeometry, plaster)
    body.position.set(0, HEIGHT / 2, -half - 0.15)
    body.castShadow = body.receiveShadow = true
    const base = new THREE.Mesh(new THREE.BoxGeometry(SIZE, 0.12, 0.04), trim)
    base.position.set(0, 0.06, -half + 0.02)
    wall.add(body, base)

    const isDoorWall = i === 2
    const material = new THREE.MeshStandardMaterial({
      map: displayTexture(display.title, display.note),
      roughness: 0.9,
    })
    const panel = new THREE.Mesh(
      new THREE.PlaneGeometry(isDoorWall ? 2.4 : 6, isDoorWall ? 0.5 : 3),
      material,
    )
    panel.position.set(0, isDoorWall ? DOOR_HEIGHT + 0.45 : 1.75, -half + 0.01)
    panel.receiveShadow = true
    wall.add(panel)
    if (isDoorWall) {
      material.map = canvasTexture(1024, 213, (g) => {
        g.fillStyle = '#ebe3d5'
        g.fillRect(0, 0, 1024, 213)
        g.fillStyle = '#2b2925'
        g.textAlign = 'center'
        g.textBaseline = 'middle'
        g.font = '300 84px "Helvetica Neue", system-ui, sans-serif'
        g.letterSpacing = '24px'
        g.fillText('EXIT', 512, 110)
      })
      const doorMaterial = new THREE.MeshStandardMaterial({ map: shojiTexture(), roughness: 0.8 })
      for (const side of [-1, 1]) {
        const door = new THREE.Mesh(
          new THREE.BoxGeometry(DOOR_PANEL_WIDTH, DOOR_HEIGHT, 0.05),
          doorMaterial,
        )
        door.position.set((side * DOOR_PANEL_WIDTH) / 2, DOOR_HEIGHT / 2, -half + 0.04)
        door.castShadow = door.receiveShadow = true
        wall.add(door)
        exitTargets.push(door)
      }
    } else {
      titlePanels.push(material)
    }
  })

  // Ceiling with an open skylight: the sky and the sun come into the room.
  const strip = (SIZE - SKYLIGHT) / 2
  for (const [width, depth, x, z] of [
    [SIZE + 0.6, strip + 0.3, 0, -(SKYLIGHT + strip) / 2 - 0.15],
    [SIZE + 0.6, strip + 0.3, 0, (SKYLIGHT + strip) / 2 + 0.15],
    [strip + 0.3, SKYLIGHT, -(SKYLIGHT + strip) / 2 - 0.15, 0],
    [strip + 0.3, SKYLIGHT, (SKYLIGHT + strip) / 2 + 0.15, 0],
  ]) {
    const slab = new THREE.Mesh(new THREE.BoxGeometry(width, 0.25, depth), plaster)
    slab.position.set(x, HEIGHT + 0.125, z)
    slab.castShadow = slab.receiveShadow = true
    room.add(slab)
  }
  // Oak frame around the skylight.
  for (const [width, depth, x, z] of [
    [SKYLIGHT + 0.2, 0.1, 0, -SKYLIGHT / 2],
    [SKYLIGHT + 0.2, 0.1, 0, SKYLIGHT / 2],
    [0.1, SKYLIGHT, -SKYLIGHT / 2, 0],
    [0.1, SKYLIGHT, SKYLIGHT / 2, 0],
  ]) {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(width, 0.3, depth), trim)
    beam.position.set(x, HEIGHT + 0.1, z)
    room.add(beam)
  }

  const setShop = (sign: ShopSign) => {
    titlePanels[0].map?.dispose()
    titlePanels[0].map = displayTexture(sign.title, '', sign)
    titlePanels[0].needsUpdate = true
  }

  return { group: room, center, entryZ: center.z + half - 1.2, exitTargets, setShop }
}
