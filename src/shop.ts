/**
 * Client for Shop MCP: products from millions of Shopify merchants, and real
 * checkouts with them. Docs: https://shop.dev/docs/index.md
 *
 * The server is JSON-RPC 2.0 over HTTPS with no session. Search and checkout
 * need no account or API key, and the server allows cross-origin calls, so the
 * browser calls it directly.
 *
 * Rules: fetch live data (no caching, no re-hosted images), keep every URL
 * exactly as returned, and send the shopper to `continue_url` to pay.
 */

const ENDPOINT = 'https://mcp.shop.com/'
const PROTOCOL_VERSION = '2026-07-28'
const CLIENT_INFO = { name: '3d-shop', version: '0.0.0' }

export interface Money {
  /** Minor currency units: 5800 is $58.00. */
  amount: number
  currency: string
}

export interface Media {
  type: 'image' | 'video' | 'external_video' | 'model_3d'
  url: string
  alt_text?: string
  width?: number
  height?: number
  preview?: { url: string; width?: number; height?: number }
}

export interface Rating {
  value: number
  scale_min: number
  scale_max: number
  count: number
}

export interface Seller {
  /** `gid://shopify/Shop/{id}` */
  id: string
  name: string
  url: string
  domain: string
}

export interface Variant {
  id: string
  title: string
  /** Product page on the seller's shop. Use it unchanged. */
  url: string
  /** Use it unchanged: it carries attribution parameters. */
  checkout_url?: string
  price: Money
  availability?: { available: boolean }
  options?: { name: string; label: string }[]
  media?: Media[]
  seller: Seller
  rating?: Rating
}

export interface Product {
  /** `gid://shopify/p/{upid}` */
  id: string
  title: string
  /** `plain` can contain HTML from the seller. Sanitize it before display. */
  description?: { plain?: string }
  handle?: string
  rating?: Rating
  media?: Media[]
  options?: { name: string; values: { label: string }[] }[]
  variants: Variant[]
  price_range?: { min: Money; max: Money }
}

export interface Context {
  address_country?: string
  address_region?: string
  postal_code?: string
  language?: string
  currency?: string
  intent?: string
}

export interface SearchFilters {
  available?: boolean
  /** Minor currency units. */
  price?: { min?: number; max?: number }
  condition?: ('new' | 'secondhand')[]
  /** Shop GIDs or shop domains. */
  shops?: string[]
  price_tier?: ('low' | 'medium' | 'high')[]
  [filter: string]: unknown
}

export interface SearchParams {
  query: string
  filters?: SearchFilters
  context?: Context
  /** 1 to 50. The server default is 10. */
  limit?: number
  /** `pagination.cursor` from the previous page. */
  cursor?: string
}

export interface Message {
  /** Show each `warning` to the shopper. */
  type: 'info' | 'warning' | 'error'
  code?: string
  content: string
  severity?: string
}

export interface SearchResult {
  products: Product[]
  messages?: Message[]
  pagination?: { has_next_page: boolean; total_count?: number; cursor?: string }
}

let nextId = 1

async function callTool<T>(
  name: string,
  args: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      'MCP-Protocol-Version': PROTOCOL_VERSION,
      'Mcp-Method': 'tools/call',
      'Mcp-Name': name,
    },
    signal,
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: nextId++,
      method: 'tools/call',
      params: {
        name,
        arguments: args,
        _meta: {
          'io.modelcontextprotocol/protocolVersion': PROTOCOL_VERSION,
          'io.modelcontextprotocol/clientInfo': CLIENT_INFO,
          'io.modelcontextprotocol/clientCapabilities': {},
        },
      },
    }),
  })

  // A rejected request has an HTTP error status and a JSON-RPC `error` body.
  const body = await response.json().catch(() => null)
  if (body?.error) throw new Error(`Shop ${name}: ${body.error.message}`)
  if (!response.ok) throw new Error(`Shop ${name}: HTTP ${response.status}`)
  if (body?.result?.isError || !body?.result?.structuredContent) {
    const text = body?.result?.content
      ?.filter((part: { type: string }) => part.type === 'text')
      .map((part: { text: string }) => part.text)
      .join('\n')
    throw new Error(`Shop ${name}: ${text || 'no result'}`)
  }
  return body.result.structuredContent as T
}

/** Search products in all shops. Each product has one featured variant. */
export function searchCatalog(
  { limit, cursor, ...rest }: SearchParams,
  signal?: AbortSignal,
): Promise<SearchResult> {
  const pagination = limit || cursor ? { pagination: { limit, cursor } } : {}
  return callTool('search_catalog', { catalog: { ...rest, ...pagination } }, signal)
}

/** Resolve 1 to 50 product GIDs, variant GIDs or Shopify product URLs. */
export function lookupCatalog(
  ids: string[],
  context?: Context,
  signal?: AbortSignal,
): Promise<{ products: Product[] }> {
  return callTool('lookup_catalog', { catalog: { ids, context } }, signal)
}

/** Full details for one product. `selected` resolves a size or colour to a variant. */
export function getProduct(
  id: string,
  selected?: { name: string; label: string }[],
  context?: Context,
  signal?: AbortSignal,
): Promise<{ product: Product }> {
  return callTool('get_product', { catalog: { id, selected, context } }, signal)
}

export interface LineItem {
  /** `Variant.id`, exactly as search returned it. */
  variantId: string
  quantity: number
}

export interface Checkout {
  /** Contains an access key: keep it out of logs and analytics. */
  id: string
  status:
    | 'incomplete'
    | 'requires_escalation'
    | 'ready_for_complete'
    | 'complete_in_progress'
    | 'completed'
    | 'canceled'
  currency: string
  line_items: unknown[]
  totals: { type: string; display_text?: string; amount: number }[]
  messages?: Message[]
  links?: { type: string; url: string }[]
  /** The merchant's page where the shopper reviews and pays. Use it unchanged. */
  continue_url: string
  expires_at?: string
}

/**
 * Open a checkout at one merchant. It places no order: the shopper pays on
 * `continue_url`. `shop` is `Variant.seller.domain`. Items from more than one
 * merchant need one checkout for each merchant.
 */
export function createCheckout(
  shop: string,
  items: LineItem[],
  context?: Context,
  signal?: AbortSignal,
): Promise<Checkout> {
  return callTool(
    'create_checkout',
    {
      shop,
      checkout: {
        line_items: items.map(({ variantId, quantity }) => ({ item: { id: variantId }, quantity })),
        context,
      },
      meta: { 'idempotency-key': crypto.randomUUID() },
    },
    signal,
  )
}

/** Read a checkout again, for example to see if the order is placed. */
export function getCheckout(shop: string, id: string, signal?: AbortSignal): Promise<Checkout> {
  return callTool('get_checkout', { shop, id }, signal)
}
