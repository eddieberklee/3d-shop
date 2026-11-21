/**
 * Developer page (`/model-preview.html?p=<product slug>&yaw=35`): one product's
 * green-screen image beside its Neon model (left) and Argon model (right).
 */
import * as THREE from 'three/webgpu'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'

type Entry = { title: string; shop: string; neon?: string; argon?: string; seconds?: Record<string, number> }
const manifest: { products: Record<string, Entry> } = await (await fetch('/generated/models/manifest.json')).json()
const slugOf = (id: string) => id.split('/').pop()!
const params = new URLSearchParams(location.search)
const ids = Object.keys(manifest.products)
const id = ids.find((candidate) => slugOf(candidate) === params.get('p')) ?? ids[0]
const entry = manifest.products[id]

document.querySelector<HTMLImageElement>('#cutout')!.src = `/generated/models/${slugOf(id)}/cutout.jpg`
document.querySelector('#label')!.textContent =
  `${entry.shop} — ${entry.title} · left: Neon (${entry.seconds?.neon ?? '–'} s) · right: Argon (${entry.seconds?.argon ?? '–'} s)`
document.querySelector('#list')!.innerHTML = ids
  .map((other) => `<a href="?p=${slugOf(other)}">${manifest.products[other].title.slice(0, 24)}</a>`)
  .join('')

const canvas = document.querySelector<HTMLCanvasElement>('#stage')!
const renderer = new THREE.WebGPURenderer({ canvas, antialias: true })
await renderer.init()
renderer.toneMapping = THREE.AgXToneMapping
const scene = new THREE.Scene()
scene.background = new THREE.Color(0xefe8db)
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture
const camera = new THREE.PerspectiveCamera(30, 1, 0.01, 50)
const yaw = THREE.MathUtils.degToRad(Number(params.get('yaw') ?? 30))

const loader = new GLTFLoader()
const place = async (url: string | undefined, x: number) => {
  if (!url) return
  const { scene: model } = await loader.loadAsync(url)
  const box = new THREE.Box3().setFromObject(model)
  const size = box.getSize(new THREE.Vector3())
  const centre = box.getCenter(new THREE.Vector3())
  // Fit each model in a unit box, centred, then turn it to a three-quarter view.
  const holder = new THREE.Group()
  model.position.sub(centre)
  holder.add(model)
  holder.scale.setScalar(1 / Math.max(size.x, size.y, size.z))
  holder.rotation.set(THREE.MathUtils.degToRad(12), yaw, 0)
  holder.position.x = x
  scene.add(holder)
}
await Promise.all([place(entry.neon, -0.65), place(entry.argon, 0.65)])

const draw = () => {
  const width = canvas.clientWidth
  const height = canvas.clientHeight
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
  renderer.setSize(width, height, false)
  camera.aspect = width / height
  camera.position.set(0, 0, Math.max(4.6, 5.2 / camera.aspect))
  camera.updateProjectionMatrix()
  renderer.render(scene, camera)
}
new ResizeObserver(draw).observe(canvas)
draw()
document.documentElement.dataset.ready = 'true'
