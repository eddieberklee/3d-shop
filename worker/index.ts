import { findIcon } from '../server/iconLookup.ts'
import { SHOPS } from '../src/shopList.ts'

/**
 * The Cloudflare Worker behind the deployed site. Cloudflare serves the built
 * page from `dist`; only `/api/*` requests reach this code (`wrangler.jsonc`).
 *
 * It answers the same endpoints as the dev-server plugins in `server/`:
 * - `GET /api/shop-logo?url=<shop url>`: `{ "url": <icon URL> | null }`.
 * - `GET /api/product-clicks`: `{ "counts": { <product id>: <clicks> } }`.
 * - `POST /api/product-click` with `{ "id": <product id> }`: `{ "id", "clicks" }`.
 *
 * Click counts are in D1 (table `product_clicks`, see `migrations/`).
 */
export interface Env {
  DB: D1Database
}

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

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url)
    const route = `${request.method} ${url.pathname}`
    try {
      if (route === 'GET /api/shop-logo') return await shopLogo(url)
      if (route === 'GET /api/product-clicks') return await productClicks(env)
      if (route === 'POST /api/product-click') return await productClick(request, env)
    } catch {
      return json(500, { error: 'server error' })
    }
    return json(404, { error: 'not found' })
  },
} satisfies ExportedHandler<Env>
