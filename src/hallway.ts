import * as THREE from 'three/webgpu'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import type { Stage } from './stage'

/** All sizes are metres. The hall runs from z = 0 to z = -LENGTH. */
const WIDTH = 8
const HEIGHT = 5
const BAY = 7
const BAYS_PER_SIDE = 14
const LENGTH = BAY * BAYS_PER_SIDE
const FRONT_WIDTH = 6
const FRONT_HEIGHT = 4.2
const HAZE = 0xe9e6e0

export interface Hallway {
  /** The camera can move between these z positions. */
  zStart: number
  zEnd: number
  /** Number of shops: even indexes are on the left, odd indexes on the right. */
  shopCount: number
  /** Replace a shop's placeholder with an image (for example a generated storefront). */
  setStorefrontImage: (shop: number, url: string) => void
}

function tileTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 512
  const g = canvas.getContext('2d')!
  g.fillStyle = '#d9d5cd'
  g.fillRect(0, 0, 512, 512)
  g.strokeStyle = '#b9b4aa'
  g.lineWidth = 3
  g.strokeRect(0, 0, 512, 512)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(WIDTH, LENGTH)
  texture.anisotropy = 8
  return texture
}

/** Placeholder storefront: a sign band above a lit window. */
function placeholderTexture(shop: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 1024
  canvas.height = 716
  const g = canvas.getContext('2d')!
  const hue = (shop * 47) % 360
  const name = `SHOP ${String(shop + 1).padStart(2, '0')}`

  g.fillStyle = '#17171a'
  g.fillRect(0, 0, 1024, 716)
  g.fillStyle = '#fff'
  g.font = '600 72px system-ui, sans-serif'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText(name, 512, 80)

  const glow = g.createLinearGradient(0, 160, 0, 716)
  glow.addColorStop(0, `hsl(${hue} 45% 78%)`)
  glow.addColorStop(1, `hsl(${hue} 40% 52%)`)
  g.fillStyle = glow
  g.fillRect(40, 160, 944, 516)
  g.fillStyle = 'rgba(255,255,255,0.35)'
  g.fillRect(40, 160, 944, 10)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 8
  return texture
}

export function buildHallway({ scene, renderer, invalidate }: Stage): Hallway {
  const hall = new THREE.Group()
  hall.name = 'hallway'
  scene.add(hall)

  // Light: an image-based room light for soft reflections, and a bright haze
  // that hides the far end of the hall.
  const pmrem = new THREE.PMREMGenerator(renderer)
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
  scene.environmentIntensity = 1.6
  scene.background = new THREE.Color(HAZE)
  scene.fog = new THREE.Fog(HAZE, 25, LENGTH * 0.95)

  const midZ = -LENGTH / 2

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(WIDTH, LENGTH),
    new THREE.MeshStandardMaterial({ map: tileTexture(), roughness: 0.18, metalness: 0 }),
  )
  floor.rotation.x = -Math.PI / 2
  floor.position.z = midZ
  hall.add(floor)

  const ceiling = new THREE.Mesh(
    new THREE.PlaneGeometry(WIDTH, LENGTH),
    new THREE.MeshStandardMaterial({ color: 0xf4f2ee, roughness: 0.9 }),
  )
  ceiling.rotation.x = Math.PI / 2
  ceiling.position.set(0, HEIGHT, midZ)
  hall.add(ceiling)

  const wallMaterial = new THREE.MeshStandardMaterial({ color: 0xece9e3, roughness: 0.7 })
  for (const side of [-1, 1]) {
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(LENGTH, HEIGHT), wallMaterial)
    wall.rotation.y = -side * (Math.PI / 2)
    wall.position.set(side * (WIDTH / 2), HEIGHT / 2, midZ)
    hall.add(wall)
  }

  // Ceiling light strips and wall pillars: one draw call for each kind.
  const strips = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.5, 0.04, BAY * 0.6),
    new THREE.MeshBasicMaterial({ color: 0xffffff }),
    BAYS_PER_SIDE,
  )
  const pillars = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.24, HEIGHT, BAY - FRONT_WIDTH),
    new THREE.MeshStandardMaterial({ color: 0x2a2a2e, roughness: 0.4, metalness: 0.6 }),
    (BAYS_PER_SIDE + 1) * 2,
  )
  const matrix = new THREE.Matrix4()
  for (let bay = 0; bay < BAYS_PER_SIDE; bay++) {
    strips.setMatrixAt(bay, matrix.makeTranslation(0, HEIGHT - 0.02, -(bay + 0.5) * BAY))
  }
  for (let i = 0; i <= BAYS_PER_SIDE; i++) {
    pillars.setMatrixAt(i * 2, matrix.makeTranslation(-WIDTH / 2 + 0.12, HEIGHT / 2, -i * BAY))
    pillars.setMatrixAt(i * 2 + 1, matrix.makeTranslation(WIDTH / 2 - 0.12, HEIGHT / 2, -i * BAY))
  }
  hall.add(strips, pillars)

  // Storefronts: one image plane for each shop.
  const frontGeometry = new THREE.PlaneGeometry(FRONT_WIDTH, FRONT_HEIGHT)
  const fronts: THREE.MeshBasicMaterial[] = []
  for (let shop = 0; shop < BAYS_PER_SIDE * 2; shop++) {
    const side = shop % 2 === 0 ? -1 : 1
    const bay = Math.floor(shop / 2)
    const material = new THREE.MeshBasicMaterial({ map: placeholderTexture(shop) })
    const front = new THREE.Mesh(frontGeometry, material)
    front.name = `shop-${shop}`
    front.rotation.y = -side * (Math.PI / 2)
    front.position.set(side * (WIDTH / 2 - 0.02), FRONT_HEIGHT / 2, -(bay + 0.5) * BAY)
    hall.add(front)
    fronts.push(material)
  }

  const loader = new THREE.TextureLoader()
  const setStorefrontImage = (shop: number, url: string) => {
    const material = fronts[shop]
    if (!material) return
    loader.load(url, (texture) => {
      texture.colorSpace = THREE.SRGBColorSpace
      texture.anisotropy = 8
      material.map?.dispose()
      material.map = texture
      material.needsUpdate = true
      invalidate()
    })
  }

  invalidate()
  return { zStart: -1.5, zEnd: -LENGTH + 6, shopCount: fronts.length, setStorefrontImage }
}
