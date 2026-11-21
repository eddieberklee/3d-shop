import type { Connect, Plugin } from 'vite'

/**
 * `GET /api/shop-logo?url=https://shop.example` answers `{ "url": <icon URL> | null }`.
 *
 * It reads the shop's home page and returns the address of its site icon. The
 * browser then loads the icon straight from the shop's own server: nothing is
 * stored or re-hosted here. A browser cannot read another site's HTML itself,
 * so this small lookup runs in the dev server.
 */
const TIMEOUT_MS = 8000
const MAX_HTML_BYTES = 600_000

function isPublicShopUrl(value: string): URL | null {
  try {
    const url = new URL(value)
    const host = url.hostname
    const looksLocal =
      !host.includes('.') || /^[\d.]+$/.test(host) || host.includes(':') || /\.(local|internal|lan)$/.test(host)
    return url.protocol === 'https:' && !looksLocal ? url : null
  } catch {
    return null
  }
}

async function findIcon(shop: URL): Promise<string | null> {
  const response = await fetch(shop, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; storefront-icon-lookup)', Accept: 'text/html' },
  })
  if (!response.ok) return null
  const html = (await response.text()).slice(0, MAX_HTML_BYTES)
  const links = [...html.matchAll(/<link\b[^>]*>/gi)]
    .map((match) => match[0])
    .filter((link) => /rel=["'][^"']*icon/i.test(link))
  // The touch icon is the largest one a site publishes.
  const link = links.find((candidate) => /apple-touch-icon/i.test(candidate)) ?? links[0]
  const href = link?.match(/href=["']([^"']+)/i)?.[1]
  if (!href) return null

  const icon = new URL(href.replace(/&amp;/g, '&'), response.url)
  if (icon.protocol !== 'https:') return null
  // Shopify's image server sizes an image on request. Ask for a sharp one.
  if (icon.pathname.includes('/cdn/shop/')) {
    if (icon.searchParams.has('width')) icon.searchParams.set('width', '256')
    if (icon.searchParams.has('height')) icon.searchParams.set('height', '256')
  }
  return icon.href
}

const handler: Connect.NextHandleFunction = (request, response, next) => {
  const { pathname, searchParams } = new URL(request.url ?? '', 'http://localhost')
  if (pathname !== '/api/shop-logo') return next()
  const shop = isPublicShopUrl(searchParams.get('url') ?? '')
  const send = (status: number, url: string | null) => {
    response.statusCode = status
    response.setHeader('Content-Type', 'application/json')
    response.setHeader('Cache-Control', 'no-store')
    response.end(JSON.stringify({ url }))
  }
  if (!shop) return send(400, null)
  findIcon(shop).then(
    (url) => send(200, url),
    () => send(200, null),
  )
}

export function shopLogo(): Plugin {
  return {
    name: 'shop-logo',
    configureServer: (server) => void server.middlewares.use(handler),
    configurePreviewServer: (server) => void server.middlewares.use(handler),
  }
}
