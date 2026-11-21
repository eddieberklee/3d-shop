import type { Connect, Plugin } from 'vite'
import { findIcon, isPublicShopUrl } from './iconLookup.ts'

/**
 * `GET /api/shop-logo?url=https://shop.example` answers `{ "url": <icon URL> | null }`.
 *
 * It reads the shop's home page and returns the address of its site icon. The
 * browser then loads the icon straight from the shop's own server: nothing is
 * stored or re-hosted here. A browser cannot read another site's HTML itself,
 * so this small lookup runs in the dev server.
 */

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
