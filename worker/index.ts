import { findIcon } from '../server/iconLookup.ts'
import { BadRequest, MAX_BODY_BYTES as MAX_TRY_ON_BYTES, tryOnFromBody } from '../server/tryOnCore.ts'
import { SHOPS } from '../src/shopList.ts'

/**
 * The Cloudflare Worker behind the deployed site. Cloudflare serves the built
 * page from `dist`; only `/api/*` requests reach this code (`wrangler.jsonc`).
 *
 * It answers the same endpoints as the dev-server plugins in `server/`:
 * - `GET /api/shop-logo?url=<shop url>`: `{ "url": <icon URL> | null }`.
 * - `GET /api/product-clicks`: `{ "counts": { <product id>: <clicks> } }`.
 * - `POST /api/product-click` with `{ "id": <product id> }`: `{ "id", "clicks" }`.
 * - `POST /api/try-on` with `{ selfie, product, title }`: `{ "image": <data URL> }`.
 *   It costs money for each call, so it takes calls from this site's own pages
 *   only, and has a daily limit for each visitor and for all visitors.
 *
 * Click counts are in D1 (table `product_clicks`, see `migrations/`).
 */
export interface Env {
  DB: D1Database
  /** Secret: `wrangler secret put GEMINI_API_KEY`. */
  GEMINI_API_KEY?: string
}

/** Try-on pictures in one UTC day: for one visitor, and for all visitors. */
const TRY_ON_VISITOR_LIMIT = 15
const TRY_ON_DAY_LIMIT = 300

const MAX_BODY_BYTES = 1024
/** Only the hall's own shops are looked up, so this is no open fetch proxy. */
const SHOP_URLS = new Set(SHOPS.map((shop) => shop.url))
const PINNED = new Set(SHOPS.flatMap((shop) => shop.products))

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })

async function shopLogo(url: URL): Promise<Response> {
  const shop = url.searchParams.get('url') ?? ''
  if (!SHOP_URLS.has(shop)) return json(400, { url: null })
  try {
    return json(200, { url: await findIcon(new URL(shop)) })
  } catch {
    return json(200, { url: null })
  }
}

async function productClicks(env: Env): Promise<Response> {
  const { results } = await env.DB.prepare('SELECT id, clicks FROM product_clicks').all<{
    id: string
    clicks: number
  }>()
  const counts: Record<string, number> = {}
  for (const { id, clicks } of results) if (PINNED.has(id) && clicks > 0) counts[id] = clicks
  return json(200, { counts })
}

async function productClick(request: Request, env: Env): Promise<Response> {
  if (Number(request.headers.get('Content-Length') ?? 0) > MAX_BODY_BYTES) {
    return json(400, { error: 'bad request' })
  }
  let id: unknown
  try {
    const body = await request.text()
    if (body.length > MAX_BODY_BYTES) return json(400, { error: 'bad request' })
    id = (JSON.parse(body) as { id?: unknown })?.id
  } catch {
    return json(400, { error: 'bad request' })
  }
  if (typeof id !== 'string' || !PINNED.has(id)) return json(400, { error: 'unknown product' })
  // One statement, so two clicks at the same time both count.
  const row = await env.DB.prepare(
    `INSERT INTO product_clicks (id, clicks) VALUES (?1, 1)
     ON CONFLICT (id) DO UPDATE SET clicks = clicks + 1
     RETURNING clicks`,
  )
    .bind(id)
    .first<{ clicks: number }>()
  return json(200, { id, clicks: row?.clicks ?? 0 })
}

/** Add one to a try-on counter and answer the new count. */
async function countTryOn(env: Env, day: string, who: string): Promise<number> {
  const row = await env.DB.prepare(
    `INSERT INTO try_on_usage (day, who, count) VALUES (?1, ?2, 1)
     ON CONFLICT (day, who) DO UPDATE SET count = count + 1
     RETURNING count`,
  )
    .bind(day, who)
    .first<{ count: number }>()
  return row?.count ?? 0
}

async function tryOn(request: Request, env: Env, url: URL): Promise<Response> {
  if (!env.GEMINI_API_KEY) return json(503, { error: 'Try-on is not set up on this site.' })
  // Calls from this site's own pages only: a browser always sends Origin with a POST.
  if (request.headers.get('Origin') !== url.origin) return json(403, { error: 'forbidden' })
  if (Number(request.headers.get('Content-Length') ?? 0) > MAX_TRY_ON_BYTES) return json(413, { error: 'too large' })
  const text = await request.text()
  if (text.length > MAX_TRY_ON_BYTES) return json(413, { error: 'too large' })

  // The visitor is counted by a hash of the address, so no address is stored.
  const day = new Date().toISOString().slice(0, 10)
  const address = request.headers.get('CF-Connecting-IP') ?? 'unknown'
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${day} ${address}`))
  const visitor = [...new Uint8Array(digest).slice(0, 12)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
  if ((await countTryOn(env, day, visitor)) > TRY_ON_VISITOR_LIMIT) {
    return json(429, { error: 'You reached the try-on limit for today.' })
  }
  if ((await countTryOn(env, day, 'all')) > TRY_ON_DAY_LIMIT) {
    return json(429, { error: 'Try-on reached its limit for today. Come back tomorrow.' })
  }
  try {
    return json(200, { image: await tryOnFromBody(env.GEMINI_API_KEY, text) })
  } catch (error) {
    return json(error instanceof BadRequest ? 400 : 502, { error: (error as Error).message })
  }
}

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url)
    const route = `${request.method} ${url.pathname}`
    try {
      if (route === 'GET /api/shop-logo') return await shopLogo(url)
      if (route === 'GET /api/product-clicks') return await productClicks(env)
      if (route === 'POST /api/product-click') return await productClick(request, env)
      if (route === 'POST /api/try-on') return await tryOn(request, env, url)
    } catch {
      return json(500, { error: 'server error' })
    }
    return json(404, { error: 'not found' })
  },
} satisfies ExportedHandler<Env>
