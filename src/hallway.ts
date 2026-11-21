import * as THREE from 'three/webgpu'
import { SkyMesh } from 'three/addons/objects/SkyMesh.js'
import type { Stage } from './stage'

/** All sizes are metres. The hall runs from z = 0 to z = -LENGTH. */
const WIDTH = 8
const HEIGHT = 4.6
const BAY = 7
const BAYS_PER_SIDE = 14
const LENGTH = BAY * BAYS_PER_SIDE
const FRONT_WIDTH = 6
const FRONT_HEIGHT = 4.2
/** One sliding door panel. Each shop has two. */
export const DOOR_PANEL_WIDTH = 1.15
export const DOOR_HEIGHT = 2.7
/** The curtain over each door. Its top is at the door frame's head beam. */
const NOREN_WIDTH = 2.3
const NOREN_HEIGHT = 0.98
const NOREN_TOP = 3.02
const HAZE = 0xe9dac6
/** Degrees above the horizon, and degrees around from the hall axis. */
const SUN_ELEVATION = 31
const SUN_AZIMUTH = -24
const SUN_INTENSITY = 3.4
/** The sky shader's drift rate. This value moves a cloud across the view in about a minute. */
const CLOUD_SPEED = 0.00003
/** Frames per second for cloud motion while nothing else moves. */
const CLOUD_FPS = 30
const ENVIRONMENT_INTENSITY = 0.07
/** The roof over each shop reaches this far over the lane. */
const ROOF_REACH = 1.7
const CREAM = '#eedfc7'
const OAK = '#c8975a'
const OAK_DARK = '#a87a45'
const CHARCOAL = 0x3b3835

export interface Hallway {
  /** The camera can move between these z positions. */
  zStart: number
  zEnd: number
  /** Half the width of the walkable lane, in metres. */
  laneHalfWidth: number
  /** Number of shops: even indexes are on the left, odd indexes on the right. */
  shopCount: number
  /** Hide or show the whole hall (it is hidden while the camera is in a shop). */
  group: THREE.Group
  /** Objects a tap can hit. Give a raycaster hit to `shopAt` to get the shop. */
  tapTargets: THREE.Object3D[]
  shopAt: (hit: THREE.Intersection) => number | null
  /** Where a shop's door is: its z position and its side (-1 left, 1 right). */
  shopPose: (shop: number) => { z: number; side: -1 | 1 }
  /** Slide a shop's doors: 0 is closed, 1 is open. */
  setDoorOpen: (shop: number, amount: number) => void
  /** Put a shop's name on its door curtain, and its logo above the name when `logoUrl` loads. */
  setStorefront: (shop: number, title: string, logoUrl?: string | null) => void
  shopSign: (shop: number) => ShopSign
  /** Replace a shop's placeholder with an image (for example a generated storefront). */
  setStorefrontImage: (shop: number, url: string) => void
}

export function canvasTexture(width: number, height: number, draw: (g: CanvasRenderingContext2D) => void) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  draw(canvas.getContext('2d')!)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 8
  return texture
}

/** Grey stone pavers with fine joints. */
function paverTexture(): THREE.CanvasTexture {
  const texture = canvasTexture(512, 512, (g) => {
    g.fillStyle = '#a89c8c'
    g.fillRect(0, 0, 512, 512)
    for (let i = 0; i < 1400; i++) {
      const shade = Math.random() > 0.5 ? 235 : 70
      g.fillStyle = `rgba(${shade},${shade - 6},${shade - 14},0.03)`
      g.fillRect(Math.random() * 512, Math.random() * 512, 3 + Math.random() * 26, 3 + Math.random() * 10)
    }
    g.strokeStyle = '#938a7e'
    g.lineWidth = 4
    g.strokeRect(0, 0, 512, 512)
  })
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(WIDTH / 1.333, LENGTH / 1.333)
  return texture
}

/** Pale oak with a vertical grain. */
export function oakTexture(): THREE.CanvasTexture {
  const texture = canvasTexture(256, 1024, (g) => {
    g.fillStyle = OAK
    g.fillRect(0, 0, 256, 1024)
    for (let i = 0; i < 140; i++) {
      const x = Math.random() * 256
      g.strokeStyle = `rgba(${Math.random() > 0.5 ? '92,62,30' : '238,210,170'},${0.05 + Math.random() * 0.12})`
      g.lineWidth = 0.5 + Math.random() * 2
      g.beginPath()
      g.moveTo(x, 0)
      g.bezierCurveTo(x + 6, 340, x - 6, 680, x + 3, 1024)
      g.stroke()
    }
  })
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping
  return texture
}

/** A shoji door panel: an oak frame with a paper grid. */
export function shojiTexture(): THREE.CanvasTexture {
  return canvasTexture(256, 600, (g) => {
    g.fillStyle = '#a97f52'
    g.fillRect(0, 0, 256, 600)
    g.fillStyle = '#f3ecdf'
    g.fillRect(14, 14, 228, 572)
    g.strokeStyle = '#a97f52'
    g.lineWidth = 5
    for (let i = 1; i < 3; i++) {
      g.beginPath()
      g.moveTo(14 + (228 * i) / 3, 14)
      g.lineTo(14 + (228 * i) / 3, 586)
      g.stroke()
    }
    for (let i = 1; i < 6; i++) {
      g.beginPath()
      g.moveTo(14, 14 + (572 * i) / 6)
      g.lineTo(242, 14 + (572 * i) / 6)
      g.stroke()
    }
  })
}

const SIGN_FONT = '"Helvetica Neue", system-ui, sans-serif'
const INK = '#2b2925'

/** What a shop shows on its sign: a title, and a logo image when one loaded. */
export interface ShopSign {
  title: string
  logo?: HTMLImageElement
}

/**
 * Draw a sign: the logo (when there is one) above the title, both centred on
 * `centerX`. The title shrinks until it fits `maxWidth`.
 */
export function drawSign(
  g: CanvasRenderingContext2D,
  sign: ShopSign,
  centerX: number,
  top: number,
  height: number,
  maxWidth: number,
) {
  const { title, logo } = sign
  const logoHeight = logo ? height * 0.46 : 0
  if (logo) {
    const scale = Math.min(logoHeight / logo.naturalHeight, (maxWidth * 0.4) / logo.naturalWidth)
    const width = logo.naturalWidth * scale
    const drawn = logo.naturalHeight * scale
    g.drawImage(logo, centerX - width / 2, top + height * 0.06 + (logoHeight - drawn) / 2, width, drawn)
  }
  let size = logo ? height * 0.27 : height * 0.36
  g.fillStyle = INK
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  const text = title.toUpperCase()
  do {
    g.font = `300 ${size}px ${SIGN_FONT}`
    g.letterSpacing = `${size * 0.22}px`
    size -= 2
  } while (g.measureText(text).width > maxWidth && size > 12)
  g.fillText(text, centerX, logo ? top + height * 0.76 : top + height * 0.52)
  g.letterSpacing = '0px'
}

/**
 * The wall of one shop: cream plaster with an oak-framed window on each side of
 * the door. The door itself, the curtain and the lantern are 3D objects.
 */
function storefrontTexture(): THREE.CanvasTexture {
  return canvasTexture(1024, 716, (g) => {
    const metre = 1024 / FRONT_WIDTH
    const y = (height: number) => 716 - height * metre
    g.fillStyle = CREAM
    g.fillRect(0, 0, 1024, 716)

    const frame = (x: number, top: number, width: number, bottom: number) => {
      g.fillStyle = OAK
      g.fillRect(x, top, width, bottom - top)
    }
    const windowAt = (x: number, width: number) => {
      const top = y(3.02)
      const sill = y(0.78)
      frame(x, top, width, 716)
      // Glass: a dim, warm room behind it, with shelves and a soft reflection.
      const glass = g.createLinearGradient(0, top, 0, sill)
      glass.addColorStop(0, '#cfc3ae')
      glass.addColorStop(0.55, '#b3a590')
      glass.addColorStop(1, '#8f8270')
      g.fillStyle = glass
      g.fillRect(x + 14, top + 14, width - 28, sill - top - 22)
      g.fillStyle = 'rgba(238,223,199,0.5)'
      for (const shelf of [0.42, 0.68]) {
        const shelfY = top + (sill - top) * shelf
        g.fillRect(x + 14, shelfY, width - 28, 7)
        for (let box = 0; box < 3; box++) g.fillRect(x + 34 + box * ((width - 60) / 3), shelfY - 30, 44, 30)
      }
      const shine = g.createLinearGradient(x, top, x + width, sill)
      shine.addColorStop(0.2, 'rgba(255,255,255,0)')
      shine.addColorStop(0.5, 'rgba(255,255,255,0.16)')
      shine.addColorStop(0.62, 'rgba(255,255,255,0)')
      g.fillStyle = shine
      g.fillRect(x + 14, top + 14, width - 28, sill - top - 22)
      // Mullion, and a slatted oak panel under the sill.
      g.fillStyle = OAK
      g.fillRect(x + width / 2 - 6, top + 14, 12, sill - top - 22)
      g.strokeStyle = OAK_DARK
      g.lineWidth = 2
      for (let line = x + 10; line < x + width - 6; line += 13) {
        g.beginPath()
        g.moveTo(line, sill + 8)
        g.lineTo(line, 716)
        g.stroke()
      }
    }
    windowAt(46, 252)
    windowAt(726, 252)
    // The door frame: two posts and a head beam across the whole front.
    frame(298, y(3.14), 20, 716)
    frame(706, y(3.14), 20, 716)
    frame(36, y(3.14), 952, y(3.02) + 4)
  })
}

/** A sliding door panel: an oak frame around one pane of glass. */
function glassDoorTexture(): THREE.CanvasTexture {
  return canvasTexture(256, 600, (g) => {
    g.fillStyle = OAK
    g.fillRect(0, 0, 256, 600)
    const glass = g.createLinearGradient(0, 0, 256, 600)
    glass.addColorStop(0, '#d2c8b6')
    glass.addColorStop(0.45, '#e6ddcc')
    glass.addColorStop(0.55, '#c3b7a3')
    glass.addColorStop(1, '#a89b88')
    g.fillStyle = glass
    g.fillRect(18, 18, 220, 564)
    g.fillStyle = OAK_DARK
    g.fillRect(118, 280, 6, 60)
  })
}

/** A noren: three linen panels on a rod, with the shop's logo and name printed across them. */
function norenTexture(sign: ShopSign): THREE.CanvasTexture {
  return canvasTexture(1024, 440, (g) => {
    g.clearRect(0, 0, 1024, 440)
    for (let panel = 0; panel < 3; panel++) {
      const x = panel * 344
      const cloth = g.createLinearGradient(0, 0, 0, 440)
      cloth.addColorStop(0, '#f1e8d8')
      cloth.addColorStop(1, '#e6dac6')
      g.fillStyle = cloth
      // The panels join at the top and hang free below.
      g.fillRect(x + 4, 22, 328, 418)
      g.fillRect(x, 22, 344, 70)
      // Loops over the rod.
      for (let loop = 0; loop < 3; loop++) g.fillRect(x + 40 + loop * 110, 0, 44, 24)
    }
    drawSign(g, sign, 512, 96, 300, 900)
  })
}

export function buildHallway({ scene, renderer, camera, invalidate }: Stage): Hallway {
  const hall = new THREE.Group()
  hall.name = 'hallway'
  scene.add(hall)

  // Open sky: a physical atmosphere with a low, warm sun. The same sky lights
  // the scene through its reflection map.
  const sun = new THREE.Vector3().setFromSphericalCoords(
    1,
    THREE.MathUtils.degToRad(90 - SUN_ELEVATION),
    THREE.MathUtils.degToRad(SUN_AZIMUTH),
  )
  const sky = new SkyMesh()
  sky.scale.setScalar(900)
  sky.turbidity.value = 16
  sky.rayleigh.value = 2.6
  sky.mieCoefficient.value = 0.014
  sky.mieDirectionalG.value = 0.82
  sky.cloudCoverage.value = 0.12
  sky.cloudSpeed.value = CLOUD_SPEED
  sky.sunPosition.value.copy(sun)
  camera.far = 2000
  camera.updateProjectionMatrix()

  const skyScene = new THREE.Scene()
  skyScene.add(sky)
  scene.environment = new THREE.PMREMGenerator(renderer).fromScene(skyScene, 0, 1, 2000).texture
  scene.environmentIntensity = ENVIRONMENT_INTENSITY
  scene.add(sky)
  scene.fog = new THREE.Fog(HAZE, 55, LENGTH * 1.7)

  const sunLight = new THREE.DirectionalLight(0xffc98a, SUN_INTENSITY)
  sunLight.position.copy(sun).multiplyScalar(80).add(new THREE.Vector3(0, 0, -LENGTH / 2))
  sunLight.target.position.set(0, 0, -LENGTH / 2)
  sunLight.castShadow = true
  sunLight.shadow.mapSize.set(4096, 4096)
  sunLight.shadow.camera.left = -LENGTH / 2 - 4
  sunLight.shadow.camera.right = LENGTH / 2 + 4
  sunLight.shadow.camera.top = 16
  sunLight.shadow.camera.bottom = -16
  sunLight.shadow.camera.near = 1
  sunLight.shadow.camera.far = 200
  sunLight.shadow.bias = -0.0004
  sunLight.shadow.normalBias = 0.03
  // Warm bounce light, so the shade is not sky-blue.
  scene.add(sunLight, sunLight.target, new THREE.HemisphereLight(0xffdcb0, 0xc9a273, 0.95))

  const midZ = -LENGTH / 2

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(WIDTH, LENGTH),
    new THREE.MeshStandardMaterial({ map: paverTexture(), roughness: 0.82, metalness: 0 }),
  )
  floor.rotation.x = -Math.PI / 2
  floor.position.z = midZ
  floor.receiveShadow = true
  hall.add(floor)

  // Cream plaster walls.
  const plaster = new THREE.MeshStandardMaterial({ color: CREAM, roughness: 0.95 })
  const oakMap = oakTexture()
  const oak = new THREE.MeshStandardMaterial({ map: oakMap, roughness: 0.6 })
  for (const side of [-1, 1]) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(0.4, HEIGHT, LENGTH), plaster)
    wall.position.set(side * (WIDTH / 2 + 0.2), HEIGHT / 2, midZ)
    wall.castShadow = wall.receiveShadow = true
    hall.add(wall)
  }

  // Oak slat screens between the shops: one draw call.
  const SLATS = 7
  const slats = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.07, HEIGHT, 0.055),
    oak,
    (BAYS_PER_SIDE + 1) * 2 * SLATS,
  )
  slats.castShadow = slats.receiveShadow = true
  const matrix = new THREE.Matrix4()
  let slat = 0
  for (let i = 0; i <= BAYS_PER_SIDE; i++) {
    for (const side of [-1, 1]) {
      for (let n = 0; n < SLATS; n++) {
        slats.setMatrixAt(
          slat++,
          matrix.makeTranslation(side * (WIDTH / 2 - 0.05), HEIGHT / 2, -i * BAY + (n - (SLATS - 1) / 2) * 0.12),
        )
      }
    }
  }
  hall.add(slats)

  // A flat roof over each shop: an oak soffit with a dark edge. Each second
  // roof sits lower, so sunlight falls between them onto the lane.
  const roofCount = BAYS_PER_SIDE * 2
  const soffits = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.2, 1), oak, roofCount)
  const fascias = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 0.2, 1),
    new THREE.MeshStandardMaterial({ color: CHARCOAL, roughness: 0.7 }),
    roofCount,
  )
  soffits.castShadow = fascias.castShadow = true
  soffits.receiveShadow = true
  const scale = new THREE.Vector3()
  const place = new THREE.Vector3()
  const upright = new THREE.Quaternion()
  for (let shop = 0; shop < roofCount; shop++) {
    const side = shop % 2 === 0 ? -1 : 1
    const bay = Math.floor(shop / 2)
    const low = (bay + (side > 0 ? 1 : 0)) % 2 === 1
    const reach = low ? ROOF_REACH - 0.5 : ROOF_REACH
    const y = low ? HEIGHT - 0.75 : HEIGHT + 0.1
    const length = low ? BAY - 1.9 : BAY - 0.7
    const x = side * (WIDTH / 2 + 0.4 - (reach + 0.4) / 2)
    const z = -(bay + 0.5) * BAY
    soffits.setMatrixAt(shop, matrix.compose(place.set(x, y, z), upright, scale.set(reach + 0.4, 1, length)))
    fascias.setMatrixAt(
      shop,
      matrix.compose(place.set(x - side * 0.03, y + 0.2, z), upright, scale.set(reach + 0.52, 1, length + 0.12)),
    )
  }
  hall.add(soffits, fascias)

  // The far end: a low wall, and a maple in a stone planter.
  const endWall = new THREE.Mesh(new THREE.BoxGeometry(WIDTH + 0.8, 3.1, 0.4), plaster)
  endWall.position.set(0, 1.55, -LENGTH - 0.2)
  endWall.castShadow = endWall.receiveShadow = true
  const planter = new THREE.Mesh(
    new THREE.BoxGeometry(2.8, 0.5, 1.5),
    new THREE.MeshStandardMaterial({ color: 0xbdb4a6, roughness: 0.9 }),
  )
  planter.position.set(0, 0.25, -LENGTH + 2.4)
  planter.castShadow = planter.receiveShadow = true
  const bark = new THREE.MeshStandardMaterial({ color: 0x7a5a3c, roughness: 0.9 })
  const tree = new THREE.Group()
  tree.position.set(0, 0.5, -LENGTH + 2.4)
  const limb = (length: number, radius: number, x: number, y: number, tiltZ: number, tiltX = 0) => {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.6, radius, length, 8), bark)
    mesh.position.set(x, y, 0)
    mesh.rotation.set(tiltX, 0, tiltZ)
    mesh.castShadow = true
    tree.add(mesh)
  }
  limb(2.3, 0.075, 0.04, 1.15, -0.04)
  limb(1.5, 0.04, -0.5, 2.5, 0.75)
  limb(1.4, 0.04, 0.5, 2.7, -0.7)
  limb(1.2, 0.035, 0.05, 3.1, 0.1, 0.5)
  const leaves = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(1, 1),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, flatShading: true }),
    16,
  )
  leaves.castShadow = true
  const leafColor = new THREE.Color()
  const clumps: [number, number, number, number][] = [
    [0, 3.9, 0, 0.75], [-0.9, 3.3, 0.1, 0.7], [0.95, 3.45, -0.1, 0.72], [-1.5, 2.75, 0, 0.55],
    [1.55, 2.95, 0.1, 0.55], [-0.35, 3.1, 0.5, 0.6], [0.4, 3.0, -0.5, 0.6], [0.1, 4.45, 0, 0.5],
    [-0.75, 4.0, -0.3, 0.5], [0.8, 4.1, 0.3, 0.5], [-1.2, 3.5, -0.4, 0.45], [1.25, 3.7, 0.4, 0.45],
    [0, 3.5, 0.75, 0.5], [0, 3.6, -0.75, 0.5], [-0.5, 2.6, -0.2, 0.42], [0.6, 2.55, 0.2, 0.42],
  ]
  clumps.forEach(([x, y, z, size], index) => {
    leaves.setMatrixAt(index, matrix.compose(place.set(x, y, z), upright, scale.set(size, size * 0.42, size)))
    leaves.setColorAt(index, leafColor.setHSL(0.24 + (index % 4) * 0.012, 0.62, 0.3 + (index % 3) * 0.05))
  })
  tree.add(leaves)
  hall.add(endWall, planter, tree)

  // Storefronts: one image plane for each shop.
  const frontGeometry = new THREE.PlaneGeometry(FRONT_WIDTH, FRONT_HEIGHT)
  const frontTexture = storefrontTexture()
  const fronts: THREE.MeshStandardMaterial[] = []
  const frontMeshes: THREE.Mesh[] = []
  const signs: ShopSign[] = []
  for (let shop = 0; shop < BAYS_PER_SIDE * 2; shop++) {
    const side = shop % 2 === 0 ? -1 : 1
    const bay = Math.floor(shop / 2)
    const sign: ShopSign = { title: `Shop ${String(shop + 1).padStart(2, '0')}` }
    signs.push(sign)
    const material = new THREE.MeshStandardMaterial({ map: frontTexture, roughness: 0.9 })
    const front = new THREE.Mesh(frontGeometry, material)
    front.name = `shop-${shop}`
    front.userData.shop = shop
    frontMeshes.push(front)
    front.rotation.y = -side * (Math.PI / 2)
    front.position.set(side * (WIDTH / 2 - 0.02), FRONT_HEIGHT / 2, -(bay + 0.5) * BAY)
    front.receiveShadow = true
    hall.add(front)
    fronts.push(material)
  }

  // Sliding glass doors (two panels for each shop) and the lit doorway behind them.
  const shopCount = fronts.length
  const shopPose = (shop: number) => ({
    z: -(Math.floor(shop / 2) + 0.5) * BAY,
    side: (shop % 2 === 0 ? -1 : 1) as -1 | 1,
  })
  const doors = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.05, DOOR_HEIGHT, DOOR_PANEL_WIDTH),
    new THREE.MeshStandardMaterial({ map: glassDoorTexture(), roughness: 0.35 }),
    shopCount * 2,
  )
  doors.castShadow = doors.receiveShadow = true
  const doorways = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.01, DOOR_HEIGHT, DOOR_PANEL_WIDTH * 2),
    new THREE.MeshBasicMaterial({ color: 0xffedcf }),
    shopCount,
  )
  const setDoorOpen = (shop: number, amount: number) => {
    const { z, side } = shopPose(shop)
    const slide = DOOR_PANEL_WIDTH / 2 + amount * DOOR_PANEL_WIDTH
    const x = side * (WIDTH / 2 - 0.07)
    doors.setMatrixAt(shop * 2, matrix.makeTranslation(x, DOOR_HEIGHT / 2, z - slide))
    doors.setMatrixAt(shop * 2 + 1, matrix.makeTranslation(x, DOOR_HEIGHT / 2, z + slide))
    doors.instanceMatrix.needsUpdate = true
    invalidate()
  }
  for (let shop = 0; shop < shopCount; shop++) {
    const { z, side } = shopPose(shop)
    doorways.setMatrixAt(shop, matrix.makeTranslation(side * (WIDTH / 2 - 0.035), DOOR_HEIGHT / 2, z))
    setDoorOpen(shop, 0)
  }
  hall.add(doors, doorways)

  // A noren over each door carries the shop's sign. Beside the door: a lantern.
  const norenGeometry = new THREE.PlaneGeometry(NOREN_WIDTH, NOREN_HEIGHT)
  const norens: THREE.MeshStandardMaterial[] = []
  const norenMeshes: THREE.Mesh[] = []
  const rods = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.022, 0.022, NOREN_WIDTH + 0.3, 10), oak, shopCount)
  const lanterns = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.16, 0.36, 0.24),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 1.75, 0.8) }),
    shopCount,
  )
  const lanternCaps = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.2, 0.03, 0.28),
    new THREE.MeshStandardMaterial({ color: CHARCOAL, roughness: 0.6 }),
    shopCount * 2,
  )
  const alongLane = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2)
  const one = new THREE.Vector3(1, 1, 1)
  for (let shop = 0; shop < shopCount; shop++) {
    const { z, side } = shopPose(shop)
    const material = new THREE.MeshStandardMaterial({
      map: norenTexture(signs[shop]),
      roughness: 1,
      alphaTest: 0.5,
      side: THREE.DoubleSide,
    })
    const noren = new THREE.Mesh(norenGeometry, material)
    noren.userData.shop = shop
    noren.rotation.y = -side * (Math.PI / 2)
    noren.position.set(side * (WIDTH / 2 - 0.2), NOREN_TOP - NOREN_HEIGHT / 2, z)
    noren.castShadow = true
    hall.add(noren)
    norens.push(material)
    norenMeshes.push(noren)
    rods.setMatrixAt(shop, matrix.compose(place.set(side * (WIDTH / 2 - 0.2), NOREN_TOP - 0.02, z), alongLane, one))

    const lanternX = side * (WIDTH / 2 - 0.1)
    const lanternZ = z + DOOR_PANEL_WIDTH + 0.62
    lanterns.setMatrixAt(shop, matrix.makeTranslation(lanternX, 2.25, lanternZ))
    lanternCaps.setMatrixAt(shop * 2, matrix.makeTranslation(lanternX, 2.445, lanternZ))
    lanternCaps.setMatrixAt(shop * 2 + 1, matrix.makeTranslation(lanternX, 2.055, lanternZ))
  }
  hall.add(rods, lanterns, lanternCaps)

  const shopAt = (hit: THREE.Intersection): number | null => {
    if (hit.object === doors && hit.instanceId !== undefined) return Math.floor(hit.instanceId / 2)
    if (hit.object === doorways && hit.instanceId !== undefined) return hit.instanceId
    return typeof hit.object.userData.shop === 'number' ? hit.object.userData.shop : null
  }

  const redrawFront = (shop: number) => {
    const material = norens[shop]
    material.map?.dispose()
    material.map = norenTexture(signs[shop])
    material.needsUpdate = true
    invalidate()
  }
  const setStorefront = (shop: number, title: string, logoUrl?: string | null) => {
    if (!fronts[shop]) return
    signs[shop] = { title }
    redrawFront(shop)
    if (!logoUrl) return
    // The logo comes straight from the shop's own server. It needs CORS to go on a canvas.
    const logo = new Image()
    logo.crossOrigin = 'anonymous'
    logo.onload = () => {
      if (signs[shop].title !== title || logo.naturalWidth === 0) return
      signs[shop] = { title, logo }
      redrawFront(shop)
    }
    logo.src = logoUrl
  }

  const loader = new THREE.TextureLoader()
  const setStorefrontImage = (shop: number, url: string) => {
    const material = fronts[shop]
    if (!material) return
    loader.load(url, (texture) => {
      texture.colorSpace = THREE.SRGBColorSpace
      texture.anisotropy = 8
      if (material.map !== frontTexture) material.map?.dispose()
      material.map = texture
      material.needsUpdate = true
      invalidate()
    })
  }

  // The clouds drift without end, so the scene redraws at a low, steady rate.
  // requestAnimationFrame stops in a hidden tab, so a hidden page costs nothing.
  let lastCloudFrame = 0
  const drift = (time: number) => {
    if (time - lastCloudFrame >= 1000 / CLOUD_FPS - 1) {
      lastCloudFrame = time
      invalidate()
    }
    requestAnimationFrame(drift)
  }
  requestAnimationFrame(drift)

  return {
    zStart: -1.5,
    zEnd: -LENGTH + 6,
    laneHalfWidth: WIDTH / 2,
    shopCount,
    group: hall,
    tapTargets: [...frontMeshes, ...norenMeshes, doors, doorways],
    shopAt,
    shopPose,
    setDoorOpen,
    setStorefront,
    shopSign: (shop: number) => signs[shop],
    setStorefrontImage,
  }
}
