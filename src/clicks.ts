import { SHOPS } from './shopList'

/**
 * Product click counts, kept by the dev server (`server/productClicks.ts`).
 *
 * The products on a shop's shelves are fixed in `src/shopList.ts`. Clicks only
 * change their order: the most-clicked product takes the first slot. Without
 * the endpoint (a static build, or no network), the order is the pinned order.
 */

/** Clicks for each pinned product id. Empty when the counts cannot be read. */
export async function fetchClickCounts(signal?: AbortSignal): Promise<Record<string, number>> {
  try {
    const response = await fetch('/api/product-clicks', { signal, headers: { Accept: 'application/json' } })
    // A static host can answer with its HTML page; only JSON is the counts.
    if (!response.ok || !response.headers.get('Content-Type')?.includes('application/json')) return {}
    const body = (await response.json()) as { counts?: Record<string, number> }
    return body.counts && typeof body.counts === 'object' ? body.counts : {}
  } catch {
    return {}
  }
}

/** `ids` with the most-clicked first. Equal counts keep their order in `ids`. */
export function orderByClicks(ids: readonly string[], counts: Record<string, number>): string[] {
  const clicks = (id: string) => (Number.isFinite(counts[id]) ? counts[id] : 0)
  return ids
    .map((id, index) => ({ id, index }))
    .sort((a, b) => clicks(b.id) - clicks(a.id) || a.index - b.index)
    .map(({ id }) => id)
}

/** A shop's pinned product ids in shelf order: most clicks first. */
export async function shelfOrder(shop: number, signal?: AbortSignal): Promise<string[]> {
  const products = SHOPS[shop]?.products ?? []
  return orderByClicks(products, await fetchClickCounts(signal))
}

/** Count one click on a product. Fire and forget: a failed count changes nothing. */
export function recordProductClick(productId: string): void {
  fetch('/api/product-click', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: productId }),
    keepalive: true,
  }).catch(() => {})
}
