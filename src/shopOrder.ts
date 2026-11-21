import { SHOPS } from './shopList'

/**
 * Put the shops with the most generated 3D models nearest the start of the hall.
 *
 * `SHOPS` is sorted in place, once, before anything reads it: hall index 0 is
 * then the shop with the most models. Shops with the same count keep their
 * pinned order, so with no models (or no manifest) the pinned order stands.
 */
export async function orderShopsByModels(): Promise<void> {
  type Entry = { neon?: string; argon?: string }
  let products: Record<string, Entry>
  try {
    const response = await fetch('/generated/models/manifest.json', { cache: 'no-store' })
    if (!response.ok) return
    products = (await response.json()).products ?? {}
  } catch {
    return
  }
  const count = (ids: string[]) =>
    ids.reduce((sum, id) => sum + (products[id]?.neon ? 1 : 0) + (products[id]?.argon ? 1 : 0), 0)
  const ranked = SHOPS.map((shop, pinned) => ({ shop, pinned, models: count(shop.products) }))
  ranked.sort((a, b) => b.models - a.models || a.pinned - b.pinned)
  SHOPS.splice(0, SHOPS.length, ...ranked.map((entry) => entry.shop))
}
