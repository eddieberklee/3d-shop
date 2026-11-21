import './style.css'
import { createWalkControls } from './controls'
import { buildHallway } from './hallway'
import { createStage } from './stage'

const canvas = document.querySelector<HTMLCanvasElement>('#stage')!
const stage = await createStage(canvas)

// The active backend, readable from devtools and tests.
document.documentElement.dataset.backend = stage.backend

stage.camera.fov = 65
stage.camera.updateProjectionMatrix()

const hallway = buildHallway(stage)
const controls = createWalkControls(canvas, stage.camera, stage.invalidate, hallway)

// Full screen: a button and the F key where the browser has the Fullscreen API
// (desktop, Android, iPad). Esc leaves it. iPhone Safari has no such API: there,
// "Add to Home Screen" opens the app with no browser bars.
if (document.fullscreenEnabled) {
  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen()
    else void document.documentElement.requestFullscreen({ navigationUI: 'hide' })
  }
  const button = document.querySelector<HTMLButtonElement>('#fullscreen')!
  button.hidden = false
  button.addEventListener('click', toggleFullscreen)
  window.addEventListener('keydown', (event) => {
    if (event.key.toLowerCase() === 'f' && !event.metaKey && !event.ctrlKey) toggleFullscreen()
  })
}

if (import.meta.env.DEV) {
  Object.assign(window, { stage, hallway, controls })
  // `?view=z,yawDegrees,pitchDegrees` opens the page at that view, for visual checks.
  const view = new URLSearchParams(location.search).get('view')?.split(',').map(Number)
  if (view?.length === 3 && view.every(Number.isFinite)) {
    controls.set({ z: view[0], yaw: (view[1] * Math.PI) / 180, pitch: (view[2] * Math.PI) / 180 })
  }
}
