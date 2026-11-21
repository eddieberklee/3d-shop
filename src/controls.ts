import type * as THREE from 'three/webgpu'

const DEG = Math.PI / 180

/** Look limits. The camera cannot turn to face backward or look straight down. */
const MAX_YAW = 75 * DEG
const MAX_PITCH_UP = 35 * DEG
const MAX_PITCH_DOWN = 70 * DEG
/** A vertical swipe walks only when the camera looks along the hall. */
const CENTER_YAW = 15 * DEG
/** Movement before a gesture is read as "look" or "walk", in pixels. */
const LOCK_DISTANCE = 6
/** A swipe of one screen height walks this far, in metres. */
const WALK_PER_SCREEN = 14
/** Glide after release: speed falls by this rate each second. */
const FRICTION = 4
/** Metres per second. */
const MAX_SPEED = 12
/** A swipe across the full screen width turns the view this far. */
const YAW_PER_SCREEN = 150 * DEG
const EYE_HEIGHT = 1.6

export interface WalkControls {
  readonly yaw: number
  readonly pitch: number
  readonly z: number
  /** Jump to a view. Angles are radians; values past the limits are clamped. */
  set: (view: { yaw?: number; pitch?: number; z?: number }) => void
}

export function createWalkControls(
  canvas: HTMLCanvasElement,
  camera: THREE.PerspectiveCamera,
  invalidate: () => void,
  bounds: { zStart: number; zEnd: number },
): WalkControls {
  const state = { yaw: 0, pitch: 0, z: bounds.zStart }
  /** Metres per second along the hall. Negative is forward. */
  let velocity = 0
  let glideFrame = 0
  let lastTime = 0

  const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

  const apply = () => {
    state.yaw = clamp(state.yaw, -MAX_YAW, MAX_YAW)
    state.pitch = clamp(state.pitch, -MAX_PITCH_DOWN, MAX_PITCH_UP)
    state.z = clamp(state.z, bounds.zEnd, bounds.zStart)
    camera.rotation.set(state.pitch, state.yaw, 0, 'YXZ')
    camera.position.set(0, EYE_HEIGHT, state.z)
    invalidate()
  }

  // The glide loop runs only while the camera still moves.
  const glide = (time: number) => {
    glideFrame = 0
    const dt = Math.min((time - lastTime) / 1000, 0.05)
    lastTime = time
    state.z += velocity * dt
    velocity *= Math.exp(-FRICTION * dt)
    apply()
    const stopped = state.z === bounds.zStart || state.z === bounds.zEnd
    if (Math.abs(velocity) > 0.05 && !stopped) glideFrame = requestAnimationFrame(glide)
    else velocity = 0
  }
  const startGlide = () => {
    if (glideFrame || Math.abs(velocity) <= 0.05) return
    lastTime = performance.now()
    glideFrame = requestAnimationFrame(glide)
  }
  const stopGlide = () => {
    cancelAnimationFrame(glideFrame)
    glideFrame = 0
    velocity = 0
  }

  let pointer: {
    id: number
    startX: number
    startY: number
    x: number
    y: number
    time: number
    mode: 'look' | 'walk' | null
  } | null = null

  canvas.addEventListener('pointerdown', (event) => {
    if (pointer) return
    stopGlide()
    pointer = {
      id: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      x: event.clientX,
      y: event.clientY,
      time: event.timeStamp,
      mode: null,
    }
    try {
      canvas.setPointerCapture(event.pointerId)
    } catch {
      // Capture is not available for this pointer. The gesture still works on the canvas.
    }
  })

  canvas.addEventListener('pointermove', (event) => {
    if (!pointer || event.pointerId !== pointer.id) return
    const dx = event.clientX - pointer.x
    const dy = event.clientY - pointer.y
    const dt = Math.max(event.timeStamp - pointer.time, 1) / 1000
    pointer.x = event.clientX
    pointer.y = event.clientY
    pointer.time = event.timeStamp

    if (!pointer.mode) {
      const totalX = Math.abs(event.clientX - pointer.startX)
      const totalY = Math.abs(event.clientY - pointer.startY)
      if (Math.hypot(totalX, totalY) < LOCK_DISTANCE) return
      const vertical = totalY > totalX * 1.2
      pointer.mode = vertical && Math.abs(state.yaw) < CENTER_YAW ? 'walk' : 'look'
    }

    if (pointer.mode === 'walk') {
      // Swipe down pulls the floor toward you: the camera moves forward (-z).
      const metres = (dy / canvas.clientHeight) * WALK_PER_SCREEN
      state.z -= metres
      velocity = clamp(velocity * 0.6 + (-metres / dt) * 0.4, -MAX_SPEED, MAX_SPEED)
    } else {
      // The view follows the finger, as if you drag the scene.
      const radiansPerPixel = (camera.fov * DEG) / canvas.clientHeight
      state.yaw += (dx / canvas.clientWidth) * YAW_PER_SCREEN
      state.pitch += dy * radiansPerPixel
    }
    apply()
  })

  const release = (event: PointerEvent) => {
    if (!pointer || event.pointerId !== pointer.id) return
    const walked = pointer.mode === 'walk'
    // A finger that stopped before release does not start a glide.
    if (!walked || event.timeStamp - pointer.time > 80) velocity = 0
    pointer = null
    startGlide()
  }
  canvas.addEventListener('pointerup', release)
  canvas.addEventListener('pointercancel', release)

  // Mouse wheel and trackpad: scroll up (or two-finger swipe down) walks forward.
  canvas.addEventListener(
    'wheel',
    (event) => {
      event.preventDefault()
      velocity = clamp(velocity + event.deltaY * 0.02, -MAX_SPEED, MAX_SPEED)
      startGlide()
    },
    { passive: false },
  )

  window.addEventListener('keydown', (event) => {
    const key = event.key.toLowerCase()
    if (key === 'arrowup' || key === 'w') velocity = clamp(velocity - 3, -MAX_SPEED, MAX_SPEED)
    else if (key === 'arrowdown' || key === 's') velocity = clamp(velocity + 3, -MAX_SPEED, MAX_SPEED)
    else if (key === 'arrowleft' || key === 'a') state.yaw += 8 * DEG
    else if (key === 'arrowright' || key === 'd') state.yaw -= 8 * DEG
    else return
    apply()
    startGlide()
  })

  apply()
  return Object.assign(state, {
    set: (view: { yaw?: number; pitch?: number; z?: number }) => {
      stopGlide()
      Object.assign(state, view)
      apply()
    },
  })
}
