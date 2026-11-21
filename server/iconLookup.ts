/**
 * Find a shop's site icon: read its home page and return the icon's address.
 * Shared by the dev server (`server/shopLogo.ts`) and the Cloudflare Worker
 * (`worker/index.ts`), so it uses only web APIs (no Node, no Vite).
 */
const TIMEOUT_MS = 8000
const MAX_HTML_BYTES = 600_000

export function isPublicShopUrl(value: string): URL | null {
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

export async function findIcon(shop: URL): Promise<string | null> {
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
