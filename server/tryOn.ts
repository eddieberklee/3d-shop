import type { IncomingMessage } from 'node:http'
import { loadEnv, type Connect, type Plugin } from 'vite'

/**
 * `POST /api/try-on` with `{ selfie, product, title }` answers `{ image }`: a
 * photo of the person in the selfie wearing or using the product.
 *
 * `selfie` and `product` are image data URLs made in the browser, so this
 * endpoint fetches no URL for the caller. The Gemini key (`GEMINI_API_KEY` in
 * `.env.local`) stays in this process. Nothing is stored or logged.
 *
 * Dev server only: there is no Worker route, so the deployed site answers 404.
 */

/** Google's premium image model ("Nano Banana Pro"). */
const MODEL = 'gemini-3-pro-image'
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`
const MAX_BODY_BYTES = 12 * 1024 * 1024
const TIMEOUT_MS = 150_000

interface InlineImage {
  mimeType: string
  data: string
}

function parseDataUrl(value: unknown): InlineImage | null {
  if (typeof value !== 'string') return null
  const match = value.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/)
  return match ? { mimeType: match[1], data: match[2] } : null
}

/** The try-on picture as a data URL. Throws a message that is safe to show. */
export async function generateTryOn(
  apiKey: string,
  selfie: InlineImage,
  product: InlineImage,
  title: string,
): Promise<string> {
  const prompt =
    `Image 1 is a selfie of a person. Image 2 is a product photo: "${title}". ` +
    'Make one photorealistic photo of the same person from image 1 wearing or using the product from image 2, ' +
    'as if they try it on in a shop. Keep the face, hair, skin tone and body of the person unchanged. ' +
    'Keep the product colour, shape, material and details exactly as in image 2. ' +
    'Frame the photo so the product is fully visible on the person. Natural light, plain bright shop background. ' +
    'No text, no labels, no collage: one single photo.'
  const response = await fetch(GEMINI_URL, {
    method: 'POST',
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            { inlineData: { mimeType: selfie.mimeType, data: selfie.data } },
            { inlineData: { mimeType: product.mimeType, data: product.data } },
          ],
        },
      ],
      generationConfig: { responseModalities: ['IMAGE'] },
    }),
  })
  const body = (await response.json().catch(() => null)) as {
    candidates?: { content?: { parts?: { inlineData?: InlineImage }[] } }[]
    error?: { status?: string }
  } | null
  if (!response.ok) throw new Error(`The image model answered ${response.status} ${body?.error?.status ?? ''}`.trim())
  const image = body?.candidates?.[0]?.content?.parts?.find((part) => part.inlineData?.data)?.inlineData
  if (!image) throw new Error('The image model made no picture. Try a different selfie.')
  return `data:${image.mimeType || 'image/png'};base64,${image.data}`
}

function readBody(request: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    request.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > MAX_BODY_BYTES) {
        reject(new Error('too large'))
        request.destroy()
      } else chunks.push(chunk)
    })
    request.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    request.on('error', reject)
  })
}

export function tryOn(): Plugin {
  let apiKey = ''
  const handler: Connect.NextHandleFunction = (request, response, next) => {
    if (request.url?.split('?')[0] !== '/api/try-on') return next()
    const send = (status: number, body: unknown) => {
      response.statusCode = status
      response.setHeader('Content-Type', 'application/json')
      response.setHeader('Cache-Control', 'no-store')
      response.end(JSON.stringify(body))
    }
    if (request.method !== 'POST') return send(405, { error: 'POST only' })
    if (!apiKey) return send(503, { error: 'GEMINI_API_KEY is not set in .env.local' })
    readBody(request)
      .then((text) => {
        const body = JSON.parse(text) as { selfie?: unknown; product?: unknown; title?: unknown }
        const selfie = parseDataUrl(body.selfie)
        const product = parseDataUrl(body.product)
        if (!selfie || !product) return send(400, { error: 'selfie and product must be image data URLs' })
        const title = typeof body.title === 'string' ? body.title.replace(/["\n\r]/g, ' ').slice(0, 200) : 'product'
        return generateTryOn(apiKey, selfie, product, title).then(
          (image) => send(200, { image }),
          (error: Error) => send(502, { error: error.name === 'TimeoutError' ? 'The image model took too long.' : error.message }),
        )
      })
      .catch(() => send(400, { error: 'bad request' }))
  }
  return {
    name: 'try-on',
    configResolved: (config) => {
      apiKey = loadEnv(config.mode, config.envDir || config.root, '').GEMINI_API_KEY ?? ''
    },
    configureServer: (server) => void server.middlewares.use(handler),
    configurePreviewServer: (server) => void server.middlewares.use(handler),
  }
}
