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
 * The Worker (`worker/index.ts`) answers the same route on the deployed site.
 */

import { BadRequest, MAX_BODY_BYTES, tryOnFromBody } from './tryOnCore.ts'

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
      .then((text) => tryOnFromBody(apiKey, text))
      .then(
        (image) => send(200, { image }),
        (error: Error) => send(error instanceof BadRequest ? 400 : 502, { error: error.message || 'bad request' }),
      )
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
