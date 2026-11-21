import './style.css'
import { createStage } from './stage'

const canvas = document.querySelector<HTMLCanvasElement>('#stage')!
const stage = await createStage(canvas)

// The active backend, readable from devtools and tests.
document.documentElement.dataset.backend = stage.backend

// The scene is empty. Add content to `stage.scene`, then call `stage.invalidate()`.
