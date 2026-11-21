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
/** A swipe across the full screen width turns the view this far. */
const YAW_PER_SCREEN = 150 * DEG
/** Metres per second. */
const MAX_WALK_SPEED = 12
/** Radians per second. */
const MAX_TURN_SPEED = 360 * DEG
/** Momentum after release: speed falls by this rate each second. */
const WALK_FRICTION = 4
const TURN_FRICTION = 6
/** Share of the finger's turn speed that stays as momentum. Full speed overshoots. */
const TURN_MOMENTUM = 0.35
/** Easing rate: a higher value makes the camera follow its target more tightly. */
const EASE = 14
const EYE_HEIGHT = 1.6

type View = { yaw: number; pitch: number; z: number }

export interface WalkControls extends Readonly<View> {
  /** Jump to a view. Angles are radians; values past the limits are clamped. */
  set: (view: Partial<View>) => void
}

export function createWalkControls(
  canvas: HTMLCanvasElement,
  camera: THREE.PerspectiveCamera,
  invalidate: () => void,
  bounds: { zStart: number; zEnd: number },
): WalkControls {
  /** Where input says the camera must go, and where the camera is now. */
  const target: View = { yaw: 0, pitch: 0, z: bounds.zStart }
  const current: View = { ...target }
  /** Momentum, in units per second. It moves the target after the finger lifts. */
  const velocity: View = { yaw: 0, pitch: 0, z: 0 }
  let frame = 0
  let lastTime = 0

  const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

  const clampTarget = () => {
    target.yaw = clamp(target.yaw, -MAX_YAW, MAX_YAW)
    target.pitch = clamp(target.pitch, -MAX_PITCH_DOWN, MAX_PITCH_UP)
    target.z = clamp(target.z, bounds.zEnd, bounds.zStart)
  }

  const render = () => {
    camera.rotation.set(current.pitch, current.yaw, 0, 'YXZ')
    camera.position.set(0, EYE_HEIGHT, current.z)
    invalidate()
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

  // The loop runs only while the camera still moves, then stops.
  const tick = (time: number) => {
    frame = 0
    const dt = Math.min(Math.max(time - lastTime, 0) / 1000, 0.05)
    lastTime = time

    if (!pointer) {
      target.yaw += velocity.yaw * dt
      target.pitch += velocity.pitch * dt
      target.z += velocity.z * dt
      const turnDecay = Math.exp(-TURN_FRICTION * dt)
      velocity.yaw *= turnDecay
      velocity.pitch *= turnDecay
      velocity.z *= Math.exp(-WALK_FRICTION * dt)
    }
    clampTarget()
    // Momentum stops at a limit; the easing below gives a soft arrival.
    if (Math.abs(target.yaw) === MAX_YAW) velocity.yaw = 0
    if (target.pitch === MAX_PITCH_UP || target.pitch === -MAX_PITCH_DOWN) velocity.pitch = 0
    if (target.z === bounds.zStart || target.z === bounds.zEnd) velocity.z = 0

    const ease = 1 - Math.exp(-EASE * dt)
    current.yaw += (target.yaw - current.yaw) * ease
    current.pitch += (target.pitch - current.pitch) * ease
    current.z += (target.z - current.z) * ease

    const moving =
      Math.abs(velocity.yaw) + Math.abs(velocity.pitch) > 0.002 ||
      Math.abs(velocity.z) > 0.02 ||
      Math.abs(target.yaw - current.yaw) + Math.abs(target.pitch - current.pitch) > 0.0002 ||
      Math.abs(target.z - current.z) > 0.002
    if (moving || pointer) {
      frame = requestAnimationFrame(tick)
    } else {
      velocity.yaw = velocity.pitch = velocity.z = 0
      Object.assign(current, target)
    }
    render()
  }
  const wake = () => {
    if (frame) return
    lastTime = performance.now()
    frame = requestAnimationFrame(tick)
  }

  canvas.addEventListener('pointerdown', (event) => {
    if (pointer) return
    // A touch catches the camera: momentum stops.
    velocity.yaw = velocity.pitch = velocity.z = 0
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
      pointer.mode = vertical && Math.abs(target.yaw) < CENTER_YAW ? 'walk' : 'look'
    }

    // Each move also updates a smoothed speed, which becomes momentum on release.
    const blend = (old: number, step: number, max: number) =>
      clamp(old * 0.6 + (step / dt) * 0.4, -max, max)

    if (pointer.mode === 'walk') {
      // Swipe down pulls the floor toward you: the camera moves forward (-z).
      const metres = (-dy / canvas.clientHeight) * WALK_PER_SCREEN
      target.z += metres
      velocity.z = blend(velocity.z, metres, MAX_WALK_SPEED)
    } else {
      // The view follows the finger, as if you drag the scene.
      const yaw = (dx / canvas.clientWidth) * YAW_PER_SCREEN
      const pitch = dy * ((camera.fov * DEG) / canvas.clientHeight)
      target.yaw += yaw
      target.pitch += pitch
      velocity.yaw = blend(velocity.yaw, yaw, MAX_TURN_SPEED)
      velocity.pitch = blend(velocity.pitch, pitch, MAX_TURN_SPEED)
    }
    clampTarget()
    wake()
  })

  const release = (event: PointerEvent) => {
    if (!pointer || event.pointerId !== pointer.id) return
    // A finger that stopped before release gives no momentum.
    if (!pointer.mode || event.timeStamp - pointer.time > 80) {
      velocity.yaw = velocity.pitch = velocity.z = 0
    }
    velocity.yaw *= TURN_MOMENTUM
    velocity.pitch *= TURN_MOMENTUM
    pointer = null
    wake()
  }
  canvas.addEventListener('pointerup', release)
  canvas.addEventListener('pointercancel', release)

  // Mouse wheel and trackpad: scroll up (or two-finger swipe down) walks forward.
  canvas.addEventListener(
    'wheel',
    (event) => {
      event.preventDefault()
      velocity.z = clamp(velocity.z + event.deltaY * 0.02, -MAX_WALK_SPEED, MAX_WALK_SPEED)
      wake()
    },
    { passive: false },
  )

  window.addEventListener('keydown', (event) => {
    const key = event.key.toLowerCase()
    const push = (amount: number) => clamp(velocity.z + amount, -MAX_WALK_SPEED, MAX_WALK_SPEED)
    if (key === 'arrowup' || key === 'w') velocity.z = push(-3)
    else if (key === 'arrowdown' || key === 's') velocity.z = push(3)
    else if (key === 'arrowleft' || key === 'a') target.yaw += 12 * DEG
    else if (key === 'arrowright' || key === 'd') target.yaw -= 12 * DEG
    else return
    clampTarget()
    wake()
  })

  render()
  return Object.assign(current, {
    set: (view: Partial<View>) => {
      velocity.yaw = velocity.pitch = velocity.z = 0
      Object.assign(target, view)
      clampTarget()
      Object.assign(current, target)
      render()
    },
  })
}
