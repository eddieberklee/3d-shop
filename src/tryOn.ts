import './tryOn.css'
import type { ShelfProduct } from './shelfCubes'

/**
 * The try-on panel: take a selfie with the device camera, then show a spinner
 * while the server (`/api/try-on`) makes a photo of the shopper with the
 * product. The selfie, the open product and its picture are kept in
 * `sessionStorage` (this tab only, gone when the tab closes), so a page that
 * loads again shows the same panel. Nothing else stores the selfie.
 */
const SELFIE_MAX = 1024
const REQUEST_TIMEOUT_MS = 160_000

const SELFIE_KEY = 'tryon.selfie'
const OPEN_KEY = 'tryon.open'

function stored(key: string): string | null {
  try {
    return sessionStorage.getItem(key)
  } catch {
    return null
  }
}

function store(key: string, value: string | null): void {
  try {
    if (value === null) sessionStorage.removeItem(key)
    else sessionStorage.setItem(key, value)
  } catch {
    // Storage is full or off: the panel still works, but not across a reload.
  }
}

/** What `OPEN_KEY` holds: the open product, its photo, and its picture when that is made. */
interface OpenPanel {
  id: string
  title: string
  price: string
  buyUrl: string | null
  photo: string | null
  result: string | null
}

let selfie: string | null = stored(SELFIE_KEY)
/** Finished pictures for the current selfie, by product id. */
const results = new Map<string, string>()
let close: (() => void) | null = null

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text = ''): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (text) node.textContent = text
  return node
}

function button(label: string, onClick: () => void, primary = false): HTMLButtonElement {
  const node = element('button', primary ? 'tryon-button tryon-primary' : 'tryon-button', label)
  node.type = 'button'
  node.addEventListener('click', onClick)
  return node
}

/** A picture source drawn at no more than `SELFIE_MAX` on its long side, as a JPEG data URL. */
function toJpeg(source: CanvasImageSource, width: number, height: number): string {
  const scale = Math.min(1, SELFIE_MAX / Math.max(width, height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(width * scale)
  canvas.height = Math.round(height * scale)
  canvas.getContext('2d')!.drawImage(source, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', 0.9)
}

/** After a page load: show the panel that was open before, with its picture. */
export function restoreTryOn(): void {
  try {
    const saved = JSON.parse(stored(OPEN_KEY) ?? 'null') as OpenPanel | null
    if (!saved?.id) return
    if (saved.result && selfie) results.set(saved.id, saved.result)
    openTryOn({ id: saved.id, title: saved.title, price: saved.price, buyUrl: saved.buyUrl, image: () => saved.photo })
  } catch {
    store(OPEN_KEY, null)
  }
}

export function openTryOn(product: ShelfProduct): void {
  close?.()
  const photo = product.image()
  const save = (result: string | null) => {
    const panel: OpenPanel = { id: product.id, title: product.title, price: product.price, buyUrl: product.buyUrl, photo, result }
    store(OPEN_KEY, JSON.stringify(panel))
  }
  save(results.get(product.id) ?? null)
  const overlay = element('div', 'tryon')
  const card = element('div', 'tryon-card')
  const heading = element('div', 'tryon-heading')
  heading.append(element('div', 'tryon-title', product.title), element('div', 'tryon-price', product.price))
  const body = element('div', 'tryon-body')
  const actions = element('div', 'tryon-actions')
  // The buy button, under the picture. It opens the shop's own page; the URL is used unchanged.
  const buy = element('a', 'tryon-buy', product.price ? `Buy · ${product.price}` : 'Buy')
  buy.hidden = true
  if (product.buyUrl) {
    buy.href = product.buyUrl
    buy.target = '_blank'
    buy.rel = 'noopener'
  }
  card.append(heading, body, ...(product.buyUrl ? [buy] : []), actions)
  overlay.append(card)
  document.body.append(overlay)

  let stream: MediaStream | null = null
  let request: AbortController | null = null
  let open = true
  const stopCamera = () => {
    stream?.getTracks().forEach((track) => track.stop())
    stream = null
  }
  const onKey = (event: KeyboardEvent) => {
    if (event.key !== 'Escape') return
    // Esc closes this panel only; it does not also leave the shop.
    event.stopImmediatePropagation()
    shut()
  }
  const shut = () => {
    open = false
    stopCamera()
    request?.abort()
    window.removeEventListener('keydown', onKey, true)
    overlay.remove()
    close = null
    store(OPEN_KEY, null)
  }
  close = shut
  window.addEventListener('keydown', onKey, true)
  // A touch tap sends a late click to the same place. Ignore it, or the panel would close at once.
  const openedAt = performance.now()
  overlay.addEventListener('click', (event) => event.target === overlay && performance.now() - openedAt > 500 && shut())

  const show = (content: Node[], buttons: Node[]) => {
    body.replaceChildren(...content)
    actions.replaceChildren(...buttons, button('Close', shut))
    buy.hidden = !body.querySelector('.tryon-picture')
  }
  const spinner = (label: string) => {
    const wrap = element('div', 'tryon-wait')
    wrap.append(element('div', 'tryon-spinner'), element('div', 'tryon-note', label))
    return wrap
  }
  const retake = () => {
    selfie = null
    store(SELFIE_KEY, null)
    save(null)
    results.clear()
    void camera()
  }

  const generate = async () => {
    const taken = selfie
    if (!taken) return
    const done = results.get(product.id)
    if (done) return result(done)
    if (!photo) return show([element('div', 'tryon-note', 'The photo of this product did not load, so it cannot be tried on.')], [])
    show([spinner('Trying it on. This takes up to half a minute.')], [])
    request = new AbortController()
    const timer = window.setTimeout(() => request?.abort(), REQUEST_TIMEOUT_MS)
    try {
      const response = await fetch('/api/try-on', {
        method: 'POST',
        signal: request.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selfie: taken, product: photo, title: product.title }),
      })
      const isJson = response.headers.get('Content-Type')?.includes('application/json')
      const answer = (isJson ? await response.json().catch(() => null) : null) as { image?: string; error?: string } | null
      if (!open) return
      if (response.status === 404 || !isJson) throw new Error('Try-on is not available on this site yet.')
      if (!response.ok || !answer?.image) throw new Error(answer?.error || 'The try-on did not work.')
      if (selfie === taken) {
        results.set(product.id, answer.image)
        save(answer.image)
      }
      result(answer.image)
    } catch (error) {
      if (!open) return
      const message = (error as Error).name === 'AbortError' ? 'The try-on took too long.' : (error as Error).message
      show([element('div', 'tryon-note', message)], [button('Try again', () => void generate(), true), button('New selfie', retake)])
    } finally {
      window.clearTimeout(timer)
    }
  }

  const result = (image: string) => {
    const picture = element('img', 'tryon-picture')
    picture.src = image
    picture.alt = `You with ${product.title}`
    show([picture], [button('New selfie', retake)])
  }

  const useSelfie = (dataUrl: string) => {
    stopCamera()
    selfie = dataUrl
    store(SELFIE_KEY, dataUrl)
    results.clear()
    void generate()
  }

  /** Without a camera (no permission, or a page that is not https): take or pick a photo. */
  const filePicker = (note: string) => {
    const input = element('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.capture = 'user'
    input.hidden = true
    input.addEventListener('change', () => {
      const file = input.files?.[0]
      if (!file) return
      const picture = new Image()
      picture.onload = () => {
        useSelfie(toJpeg(picture, picture.naturalWidth, picture.naturalHeight))
        URL.revokeObjectURL(picture.src)
      }
      picture.src = URL.createObjectURL(file)
    })
    show([element('div', 'tryon-note', note), input], [button('Choose a photo', () => input.click(), true)])
  }

  const camera = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      return filePicker('This page cannot open the camera (it needs https). Take or choose a selfie.')
    }
    show([spinner('Allow the camera to take a selfie.')], [])
    try {
      // This call makes the browser ask for camera permission.
      const next = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 960 } },
        audio: false,
      })
      if (!open) return next.getTracks().forEach((track) => track.stop())
      stream = next
    } catch {
      if (open) filePicker('The camera is not available. Allow it in the browser, or choose a selfie.')
      return
    }
    const video = element('video', 'tryon-video')
    video.autoplay = video.muted = video.playsInline = true
    video.srcObject = stream
    const snap = button(
      'Take selfie',
      () => video.videoWidth > 0 && useSelfie(toJpeg(video, video.videoWidth, video.videoHeight)),
      true,
    )
    show([video], [snap])
  }

  if (selfie) void generate()
  else void camera()
}
