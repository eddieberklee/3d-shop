import { Vector3, type PerspectiveCamera } from 'three/webgpu'

const DEG = Math.PI / 180

/** Look limits. The camera cannot turn to face backward or look straight down. */
const MAX_YAW = 75 * DEG
const MAX_PITCH_UP = 35 * DEG
const MAX_PITCH_DOWN = 70 * DEG
/** Movement before a gesture is read as "look" or "walk", in pixels. */
const LOCK_DISTANCE = 6
/**
 * A drag that starts on the lane floor walks when it runs along the lane on
 * screen. This is the lowest cosine between the drag and the lane direction.
 */
const LANE_ALIGNMENT = 0.75
/** The lane floor can be grabbed up to this distance, in metres. */
const GRAB_DISTANCE = 45
/**
 * Screen pixels for each metre of floor under the finger. The limits keep the
 * walk speed sensible near the feet and near the horizon.
 */
const MIN_PIXELS_PER_METRE = 25
const MAX_PIXELS_PER_METRE = 60
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
/** A press shorter than this, with no drag, is a tap. Milliseconds. */
const TAP_TIME = 400
const EYE_HEIGHT = 1.6

export type View = { yaw: number; pitch: number; z: number; x: number }

/**
 * - `hall`: look within the limits, walk along the lane.
 * - `shop`: look all the way around, no walking.
 * - `cinematic`: input is off and no limits apply; code moves the camera with `set`.
 */
export type ControlMode = 'hall' | 'shop' | 'cinematic'

export interface WalkControls extends Readonly<View> {
  /** Jump to a view. Angles are radians; values past the mode's limits are clamped. */
  set: (view: Partial<View>) => void
  setMode: (mode: ControlMode) => void
  /** Called for a tap (a short press with no drag), with its screen position. */
  onTap: ((x: number, y: number) => void) | null
}

export function createWalkControls(
  canvas: HTMLCanvasElement,
  camera: PerspectiveCamera,
  invalidate: () => void,
  bounds: { zStart: number; zEnd: number; laneHalfWidth: number },
): WalkControls {
  /** Where input says the camera must go, and where the camera is now. */
  const target: View = { yaw: 0, pitch: 0, z: bounds.zStart, x: 0 }
  const current: View = { ...target }
  /** Momentum, in units per second. It moves the target after the finger lifts. */
  const velocity = { yaw: 0, pitch: 0, z: 0 }
  let mode: ControlMode = 'hall'
  let frame = 0
  let lastTime = 0

  const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

  const clampTarget = () => {
    if (mode === 'cinematic') return
    target.pitch = clamp(target.pitch, -MAX_PITCH_DOWN, MAX_PITCH_UP)
    if (mode !== 'hall') return
    target.yaw = clamp(target.yaw, -MAX_YAW, MAX_YAW)
    target.z = clamp(target.z, bounds.zEnd, bounds.zStart)
  }

  const render = () => {
    camera.rotation.set(current.pitch, current.yaw, 0, 'YXZ')
    camera.position.set(current.x, EYE_HEIGHT, current.z)
    invalidate()
  }

  let pointer: {
    id: number
    startX: number
    startY: number
    x: number
    y: number
    time: number
    downTime: number
    mode: 'look' | 'walk' | null
    /** Lane direction on screen (unit vector for +z) and its pixels per metre. */
    laneX: number
    laneY: number
    pixelsPerMetre: number
  } | null = null

  const point = new Vector3()
  const ahead = new Vector3()
  const toScreen = (v: Vector3) => {
    v.project(camera)
    return [(v.x * 0.5 + 0.5) * canvas.clientWidth, (-v.y * 0.5 + 0.5) * canvas.clientHeight]
  }
  /**
   * Find the lane floor under a screen position. On a hit, store how one metre
   * of the lane runs on screen there, so a drag can move the floor with the finger.
   */
  const grabLane = (x: number, y: number): boolean => {
    if (!pointer) return false
    camera.updateMatrixWorld()
    point.set((x / canvas.clientWidth) * 2 - 1, -(y / canvas.clientHeight) * 2 + 1, 0.5)
    point.unproject(camera).sub(camera.position).normalize()
    if (point.y > -0.02) return false
    const distance = -camera.position.y / point.y
    if (distance > GRAB_DISTANCE) return false
    point.multiplyScalar(distance).add(camera.position)
    if (Math.abs(point.x) > bounds.laneHalfWidth) return false

    ahead.copy(point).setZ(point.z + 1)
    const [x0, y0] = toScreen(point)
    const [x1, y1] = toScreen(ahead)
    const length = Math.hypot(x1 - x0, y1 - y0)
    if (!(length > 0.5)) return false
    pointer.laneX = (x1 - x0) / length
    pointer.laneY = (y1 - y0) / length
    pointer.pixelsPerMetre = clamp(length, MIN_PIXELS_PER_METRE, MAX_PIXELS_PER_METRE)
    return true
  }

  // The loop runs only while the camera still moves, then stops.
  const tick = (time: number) => {
    frame = 0
    const dt = Math.min(Math.max(time - lastTime, 0) / 1000, 0.05)
    lastTime = time

    if (mode !== 'hall') velocity.z = 0
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
    if (mode === 'hall' && Math.abs(target.yaw) === MAX_YAW) velocity.yaw = 0
    if (target.pitch === MAX_PITCH_UP || target.pitch === -MAX_PITCH_DOWN) velocity.pitch = 0
    if (target.z === bounds.zStart || target.z === bounds.zEnd) velocity.z = 0
    current.x = target.x

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
    if (pointer || mode === 'cinematic') return
    // A touch catches the camera: momentum stops.
    velocity.yaw = velocity.pitch = velocity.z = 0
    pointer = {
      id: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      x: event.clientX,
      y: event.clientY,
      time: event.timeStamp,
      downTime: event.timeStamp,
      mode: null,
      laneX: 0,
      laneY: 1,
      pixelsPerMetre: MIN_PIXELS_PER_METRE,
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
      const totalX = event.clientX - pointer.startX
      const totalY = event.clientY - pointer.startY
      const total = Math.hypot(totalX, totalY)
      if (total < LOCK_DISTANCE) return
      // Walk: the drag starts on the lane floor and runs along the lane, at any view angle.
      const alongLane =
        mode === 'hall' &&
        grabLane(pointer.startX, pointer.startY) &&
        Math.abs(totalX * pointer.laneX + totalY * pointer.laneY) / total >= LANE_ALIGNMENT
      pointer.mode = alongLane ? 'walk' : 'look'
    }

    // Each move also updates a smoothed speed, which becomes momentum on release.
    const blend = (old: number, step: number, max: number) =>
      clamp(old * 0.6 + (step / dt) * 0.4, -max, max)

    if (pointer.mode === 'walk') {
      // The floor follows the finger: pull it toward you and the camera moves forward (-z).
      // When the finger leaves the floor, the last lane direction stays in use.
      grabLane(event.clientX, event.clientY)
      const metres = -(dx * pointer.laneX + dy * pointer.laneY) / pointer.pixelsPerMetre
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
    const tapped =
      event.type === 'pointerup' && !pointer.mode && event.timeStamp - pointer.downTime < TAP_TIME
    pointer = null
    wake()
    if (tapped) controls.onTap?.(event.clientX, event.clientY)
  }
  canvas.addEventListener('pointerup', release)
  canvas.addEventListener('pointercancel', release)

  // Mouse wheel and trackpad: scroll up (or two-finger swipe down) walks forward.
  canvas.addEventListener(
    'wheel',
    (event) => {
      event.preventDefault()
      if (mode !== 'hall') return
      velocity.z = clamp(velocity.z + event.deltaY * 0.02, -MAX_WALK_SPEED, MAX_WALK_SPEED)
      wake()
    },
    { passive: false },
  )

  window.addEventListener('keydown', (event) => {
    if (mode === 'cinematic') return
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

  const controls: WalkControls = Object.assign(current, {
    set: (view: Partial<View>) => {
      velocity.yaw = velocity.pitch = velocity.z = 0
      Object.assign(target, view)
      clampTarget()
      Object.assign(current, target)
      render()
    },
    setMode: (next: ControlMode) => {
      mode = next
      velocity.yaw = velocity.pitch = velocity.z = 0
      if (next === 'cinematic') pointer = null
      clampTarget()
      wake()
    },
    onTap: null,
  })
  render()
  return controls
}
