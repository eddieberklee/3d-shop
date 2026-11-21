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
const HAZE = 0xe6ddd0
/** Degrees above the horizon, and degrees around from the hall axis. */
const SUN_ELEVATION = 48
const SUN_AZIMUTH = 28
const SUN_INTENSITY = 2.2
/** The sky shader's drift rate. This value moves a cloud across the view in about a minute. */
const CLOUD_SPEED = 0.00003
/** Frames per second for cloud motion while nothing else moves. */
const CLOUD_FPS = 30
const ENVIRONMENT_INTENSITY = 0.18

export interface Hallway {
  /** The camera can move between these z positions. */
  zStart: number
  zEnd: number
  /** Number of shops: even indexes are on the left, odd indexes on the right. */
  shopCount: number
  /** Replace a shop's placeholder with an image (for example a generated storefront). */
  setStorefrontImage: (shop: number, url: string) => void
}

function canvasTexture(width: number, height: number, draw: (g: CanvasRenderingContext2D) => void) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  draw(canvas.getContext('2d')!)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 8
  return texture
}

/** Large warm limestone pavers with a soft mottle. */
function paverTexture(): THREE.CanvasTexture {
  const texture = canvasTexture(512, 512, (g) => {
    g.fillStyle = '#d6cdbd'
    g.fillRect(0, 0, 512, 512)
    for (let i = 0; i < 900; i++) {
      const shade = Math.random() > 0.5 ? 255 : 90
      g.fillStyle = `rgba(${shade},${shade - 8},${shade - 20},0.035)`
      g.fillRect(Math.random() * 512, Math.random() * 512, 6 + Math.random() * 40, 4 + Math.random() * 14)
    }
    g.strokeStyle = '#b3a892'
    g.lineWidth = 3
    g.strokeRect(0, 0, 512, 512)
  })
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(WIDTH / 2, LENGTH / 2)
  return texture
}

/** Pale oak with a vertical grain. */
function oakTexture(): THREE.CanvasTexture {
  const texture = canvasTexture(256, 1024, (g) => {
    g.fillStyle = '#b98d5c'
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

/** Muted earth tones for the placeholder shop fronts. */
const NOREN = ['#a8ad98', '#c4a58c', '#d9cfbd', '#8e9aa0', '#b7b0a1', '#9c8f7e', '#c9b9a0', '#7f8b7a']

/** Placeholder storefront: an oak sign band above a linen-toned window. */
function placeholderTexture(shop: number): THREE.CanvasTexture {
  return canvasTexture(1024, 716, (g) => {
    const name = `SHOP ${String(shop + 1).padStart(2, '0')}`

    g.fillStyle = '#efe8db'
    g.fillRect(0, 0, 1024, 716)

    g.fillStyle = '#2b2925'
    g.font = '300 58px "Helvetica Neue", system-ui, sans-serif'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.letterSpacing = '14px'
    g.fillText(name, 512, 84)

    // The window: a recessed opening with a thin dark frame and a paper screen grid.
    g.fillStyle = '#2b2925'
    g.fillRect(60, 160, 904, 556)
    const tone = g.createLinearGradient(0, 170, 0, 716)
    tone.addColorStop(0, NOREN[shop % NOREN.length])
    tone.addColorStop(1, '#efe6d6')
    g.fillStyle = tone
    g.fillRect(70, 170, 884, 546)
    g.strokeStyle = 'rgba(43,41,37,0.55)'
    g.lineWidth = 4
    for (let i = 1; i < 4; i++) {
      g.beginPath()
      g.moveTo(70 + (884 * i) / 4, 170)
      g.lineTo(70 + (884 * i) / 4, 716)
      g.stroke()
    }
    g.beginPath()
    g.moveTo(70, 330)
    g.lineTo(954, 330)
    g.stroke()
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
  sky.turbidity.value = 4
  sky.rayleigh.value = 1.2
  sky.mieCoefficient.value = 0.004
  sky.mieDirectionalG.value = 0.85
  sky.cloudCoverage.value = 0.25
  sky.cloudSpeed.value = CLOUD_SPEED
  sky.sunPosition.value.copy(sun)
  camera.far = 2000
  camera.updateProjectionMatrix()

  const skyScene = new THREE.Scene()
  skyScene.add(sky)
  scene.environment = new THREE.PMREMGenerator(renderer).fromScene(skyScene, 0, 1, 2000).texture
  scene.environmentIntensity = ENVIRONMENT_INTENSITY
  scene.add(sky)
  scene.fog = new THREE.Fog(HAZE, 40, LENGTH * 1.3)

  const sunLight = new THREE.DirectionalLight(0xfff0dc, SUN_INTENSITY)
  sunLight.position.copy(sun).multiplyScalar(80).add(new THREE.Vector3(0, 0, -LENGTH / 2))
  sunLight.target.position.set(0, 0, -LENGTH / 2)
  sunLight.castShadow = true
  sunLight.shadow.mapSize.set(4096, 4096)
  sunLight.shadow.camera.left = -LENGTH / 2 - 4
  sunLight.shadow.camera.right = LENGTH / 2 + 4
  sunLight.shadow.camera.top = 14
  sunLight.shadow.camera.bottom = -14
  sunLight.shadow.camera.near = 1
  sunLight.shadow.camera.far = 200
  sunLight.shadow.bias = -0.0004
  sunLight.shadow.normalBias = 0.03
  // Warm bounce light, so the shade is not sky-blue.
  scene.add(sunLight, sunLight.target, new THREE.HemisphereLight(0xfff1dc, 0xd2b890, 0.9))

  const midZ = -LENGTH / 2

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(WIDTH, LENGTH),
    new THREE.MeshStandardMaterial({ map: paverTexture(), roughness: 0.62, metalness: 0 }),
  )
  floor.rotation.x = -Math.PI / 2
  floor.position.z = midZ
  floor.receiveShadow = true
  hall.add(floor)

  // Plaster walls with an oak cap along the top.
  const plaster = new THREE.MeshStandardMaterial({ color: 0xebe3d5, roughness: 0.95 })
  const oakMap = oakTexture()
  const oak = new THREE.MeshStandardMaterial({ map: oakMap, roughness: 0.55 })
  for (const side of [-1, 1]) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(0.4, HEIGHT, LENGTH), plaster)
    wall.position.set(side * (WIDTH / 2 + 0.2), HEIGHT / 2, midZ)
    wall.castShadow = wall.receiveShadow = true
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.14, LENGTH), oak)
    cap.position.set(side * (WIDTH / 2 + 0.1), HEIGHT + 0.07, midZ)
    cap.castShadow = true
    hall.add(wall, cap)
  }

  // Slim oak posts between the shops: one draw call.
  const posts = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.16, HEIGHT, 0.16),
    oak,
    (BAYS_PER_SIDE + 1) * 2 * 3,
  )
  posts.castShadow = posts.receiveShadow = true
  const matrix = new THREE.Matrix4()
  let post = 0
  for (let i = 0; i <= BAYS_PER_SIDE; i++) {
    for (const side of [-1, 1]) {
      for (const offset of [-0.3, 0, 0.3]) {
        posts.setMatrixAt(
          post++,
          matrix.makeTranslation(side * (WIDTH / 2 - 0.1), HEIGHT / 2, -i * BAY + offset),
        )
      }
    }
  }
  hall.add(posts)

  // Storefronts: one image plane for each shop.
  const frontGeometry = new THREE.PlaneGeometry(FRONT_WIDTH, FRONT_HEIGHT)
  const fronts: THREE.MeshStandardMaterial[] = []
  for (let shop = 0; shop < BAYS_PER_SIDE * 2; shop++) {
    const side = shop % 2 === 0 ? -1 : 1
    const bay = Math.floor(shop / 2)
    const material = new THREE.MeshStandardMaterial({ map: placeholderTexture(shop), roughness: 0.9 })
    const front = new THREE.Mesh(frontGeometry, material)
    front.name = `shop-${shop}`
    front.rotation.y = -side * (Math.PI / 2)
    front.position.set(side * (WIDTH / 2 - 0.02), FRONT_HEIGHT / 2, -(bay + 0.5) * BAY)
    front.receiveShadow = true
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

  return { zStart: -1.5, zEnd: -LENGTH + 6, shopCount: fronts.length, setStorefrontImage }
}
