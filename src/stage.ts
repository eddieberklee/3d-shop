import * as THREE from 'three/webgpu'

/** Device pixel ratio above 2 costs fill rate and gives no visible gain. */
const MAX_PIXEL_RATIO = 2

export interface Stage {
  renderer: THREE.WebGPURenderer
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  /** 'webgpu', or 'webgl2' when the browser has no WebGPU. */
  backend: 'webgpu' | 'webgl2'
  /** Ask for one frame. The stage draws only when something changed. */
  invalidate: () => void
  /** Set the image-based light (an equirectangular HDR texture or a cube map). */
  setEnvironment: (texture: THREE.Texture | null, showAsBackground?: boolean) => void
}

export async function createStage(canvas: HTMLCanvasElement): Promise<Stage> {
  const renderer = new THREE.WebGPURenderer({
    canvas,
    antialias: true,
    powerPreference: 'high-performance',
    // `?webgl` in the URL forces the WebGL 2 fallback, for comparison and tests.
    forceWebGL: new URLSearchParams(location.search).has('webgl'),
  })
  await renderer.init()

  // Physically based output: linear HDR lighting, filmic tone map, sRGB display.
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 0.85
  renderer.shadowMap.enabled = true

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 200)
  camera.position.set(0, 1.6, 5)

  const backend = (renderer.backend as { isWebGPUBackend?: boolean }).isWebGPUBackend
    ? 'webgpu'
    : 'webgl2'

  // Render on demand: one frame for each change, zero work when nothing moves.
  // requestAnimationFrame does not fire in a hidden tab, so a hidden page costs nothing.
  let frame = 0
  const invalidate = () => {
    if (frame) return
    frame = requestAnimationFrame(() => {
      frame = 0
      renderer.render(scene, camera)
    })
  }

  const resize = () => {
    const width = canvas.clientWidth
    const height = canvas.clientHeight
    if (width === 0 || height === 0) return
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO))
    renderer.setSize(width, height, false)
    camera.aspect = width / height
    camera.updateProjectionMatrix()
    invalidate()
  }
  new ResizeObserver(resize).observe(canvas)
  resize()

  const setEnvironment: Stage['setEnvironment'] = (texture, showAsBackground = true) => {
    scene.environment = texture
    scene.background = showAsBackground ? texture : null
    invalidate()
  }

  return { renderer, scene, camera, backend, invalidate, setEnvironment }
}
