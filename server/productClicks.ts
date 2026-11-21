import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import type { IncomingMessage } from 'node:http'
import { dirname, join } from 'node:path'
import type { Connect, Plugin } from 'vite'
import { SHOPS } from '../src/shopList.ts'

/**
 * Product click counts, shared by everyone who opens this dev server.
 *
 * - `GET /api/product-clicks` answers `{ "counts": { <product id>: <clicks> } }`.
 * - `POST /api/product-click` with `{ "id": <product id> }` adds one click and
 *   answers `{ "id", "clicks" }`.
 *
 * Only the product ids pinned in `src/shopList.ts` are counted. The counts are
 * saved in `.data/product-clicks.json` (git-ignored) under the project root.
 * They change the order on the shelves, never which products are there.
 */
const DATA_FILE = '.data/product-clicks.json'
const MAX_BODY_BYTES = 1024
/** Clicks that come close together go to disk in one write. */
const SAVE_DELAY_MS = 500

const PINNED = new Set(SHOPS.flatMap((shop) => shop.products))

function readBody(request: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = ''
    request.setEncoding('utf8')
    request.on('data', (chunk: string) => {
      body += chunk
      if (body.length > MAX_BODY_BYTES) {
        reject(new Error('body too large'))
        request.destroy()
      }
    })
    request.on('end', () => resolve(body))
    request.on('error', reject)
  })
}

function createStore(root: string) {
  const file = join(root, DATA_FILE)
  const counts = new Map<string, number>()
  let saveTimer: ReturnType<typeof setTimeout> | undefined
  let saving = Promise.resolve()

  const loaded = readFile(file, 'utf8')
    .then((text) => {
      for (const [id, clicks] of Object.entries(JSON.parse(text) as Record<string, unknown>)) {
        if (PINNED.has(id) && Number.isSafeInteger(clicks) && (clicks as number) > 0) {
          counts.set(id, clicks as number)
        }
      }
    })
    .catch(() => {}) // No file yet, or an unreadable one: start from zero.

  // Write a temporary file and rename it, so a crash never leaves half a file.
  const save = () => {
    saving = saving
      .then(async () => {
        await mkdir(dirname(file), { recursive: true })
        const temporary = `${file}.${process.pid}.tmp`
        await writeFile(temporary, `${JSON.stringify(Object.fromEntries(counts), null, 2)}\n`)
        await rename(temporary, file)
      })
      .catch((error: unknown) => console.warn(`[product-clicks] save failed: ${String(error)}`))
  }

  return {
    async all() {
      await loaded
      return Object.fromEntries(counts)
    },
    async add(id: string) {
      await loaded
      const clicks = (counts.get(id) ?? 0) + 1
      counts.set(id, clicks)
      clearTimeout(saveTimer)
      saveTimer = setTimeout(save, SAVE_DELAY_MS)
      return clicks
    },
  }
}

function handler(store: ReturnType<typeof createStore>): Connect.NextHandleFunction {
  return (request, response, next) => {
    const { pathname } = new URL(request.url ?? '', 'http://localhost')
    const send = (status: number, body: unknown) => {
      response.statusCode = status
      response.setHeader('Content-Type', 'application/json')
      response.setHeader('Cache-Control', 'no-store')
      response.end(JSON.stringify(body))
    }

    if (pathname === '/api/product-clicks' && request.method === 'GET') {
      store.all().then((counts) => send(200, { counts }), () => send(500, { counts: {} }))
      return
    }
    if (pathname === '/api/product-click' && request.method === 'POST') {
      readBody(request)
        .then((body) => {
          const id = (JSON.parse(body) as { id?: unknown })?.id
          if (typeof id !== 'string' || !PINNED.has(id)) return send(400, { error: 'unknown product' })
          return store.add(id).then((clicks) => send(200, { id, clicks }))
        })
        .catch(() => send(400, { error: 'bad request' }))
      return
    }
    next()
  }
}

export function productClicks(): Plugin {
  return {
    name: 'product-clicks',
    // A click must not reload the page: the dev server does not watch the data file.
    config: () => ({ server: { watch: { ignored: ['**/.data/**'] } } }),
    configureServer: (server) => void server.middlewares.use(handler(createStore(server.config.root))),
    configurePreviewServer: (server) =>
      void server.middlewares.use(handler(createStore(server.config.root))),
  }
}
