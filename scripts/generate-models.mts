/**
 * Make a 3D model of each pinned product, with Gemini.
 *
 *   node --experimental-strip-types scripts/generate-models.mts --shop 0 --limit 2
 *   node --experimental-strip-types scripts/generate-models.mts --shop all --models neon,argon
 *
 * For each product:
 *   1. Read its live image from Shop MCP.
 *   2. An image model cuts the product out and puts it on a green screen.
 *   3. Gemini 4 Neon and Gemini 4 Argon each look at that image and write a 3D
 *      model as a list of simple solids (a JSON "spec").
 *   4. This script turns each spec into a `.glb` file.
 *
 * Output goes to `public/generated/models/` (git-ignored) with a
 * `manifest.json` that the app reads. Finished work is skipped on a rerun;
 * `--force` makes it again.
 *
 * The key comes from `.env.local` (`GEMINI_API_KEY`) and is never printed.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import https from 'node:https'
import path from 'node:path'
import { lookupCatalog } from '../src/shop.ts'
import { SHOPS } from '../src/shopList.ts'
import { specToGlb, type ModelSpec } from './modelSpec.mts'

const ROOT = path.resolve(import.meta.dirname, '..')
const OUT = path.join(ROOT, 'public/generated/models')
const MANIFEST = path.join(OUT, 'manifest.json')
const API = 'https://generativelanguage.googleapis.com/v1beta/models'
const IMAGE_MODEL = 'gemini-nano-banana-2.1'
const MODEL_IDS: Record<string, string> = { neon: 'gemini-4-neon', argon: 'gemini-4-argon' }
/** Milliseconds. A 3D spec can take minutes of model thinking. */
const IMAGE_TIMEOUT = 180_000
const SPEC_TIMEOUT = 900_000

const args = new Map<string, string>()
for (let i = 2; i < process.argv.length; i++) {
  const name = process.argv[i]
  if (!name.startsWith('--')) continue
  const next = process.argv[i + 1]
  args.set(name.slice(2), next && !next.startsWith('--') ? next : 'true')
}
const shopArg = args.get('shop') ?? '0'
const limit = Number(args.get('limit') ?? 99)
const models = (args.get('models') ?? 'neon,argon').split(',').filter((name) => MODEL_IDS[name])
const force = args.has('force')
const concurrency = Number(args.get('concurrency') ?? 4)
/**
 * `--thinking low|medium|high`: how long Neon may think. Unset = its default,
 * which takes about 5 minutes for each product; `low` takes about 1 minute.
 */
const thinking = args.get('thinking')

const key = (await readFile(path.join(ROOT, '.env.local'), 'utf8')).match(/^GEMINI_API_KEY=(.*)$/m)?.[1].trim()
if (!key) throw new Error('GEMINI_API_KEY is not in .env.local')

/** One shared connection pool: many parallel calls must not each open a new connection. */
const agent = new https.Agent({ keepAlive: true, maxSockets: 48 })

/** Try a network step again after a connection error, a rate limit or a server error. */
async function retry<T>(step: () => Promise<T>): Promise<T> {
  const waits = [3000, 10_000, 30_000, 60_000]
  for (let attempt = 0; ; attempt++) {
    try {
      return await step()
    } catch (error) {
      const text = `${error} ${(error as { cause?: unknown }).cause ?? ''}`
      const temporary = /fetch failed|AggregateError|ECONN|ETIMEDOUT|EAI_AGAIN|socket|HTTP (429|5\d\d)|overloaded|no answer in/i.test(text)
      if (!temporary || attempt >= waits.length) throw error
      await new Promise((resolve) => setTimeout(resolve, waits[attempt] * (0.7 + Math.random() * 0.6)))
    }
  }
}

type Part = { text?: string; inlineData?: { mimeType: string; data: string } }

/**
 * One Gemini call. The answer is streamed, because a model can think for
 * minutes before its first word and a plain request times out.
 */
async function gemini(model: string, parts: Part[], generationConfig: object, timeout: number) {
  const out: Part[] = []
  let tokens: number | undefined
  let finish = 'no candidate'
  const read = (line: string) => {
    if (!line.startsWith('data:')) return
    const event = JSON.parse(line.slice(5))
    if (event.error) throw new Error(`${model}: ${event.error.message}`.slice(0, 300))
    const candidate = event.candidates?.[0]
    for (const part of candidate?.content?.parts ?? []) {
      // Thought summaries are not part of the answer.
      if (!part.thought) out.push(part)
    }
    finish = candidate?.finishReason ?? finish
    tokens = event.usageMetadata?.totalTokenCount ?? tokens
  }
  // node:https, not fetch: fetch drops a connection that is silent for 5 minutes.
  await new Promise<void>((resolve, reject) => {
    const request = https.request(
      `${API}/${model}:streamGenerateContent?alt=sse`,
      { method: 'POST', agent, headers: { 'x-goog-api-key': key!, 'Content-Type': 'application/json' } },
      (response) => {
        let buffer = ''
        response.setEncoding('utf8')
        response.on('data', (chunk: string) => {
          buffer += chunk
          if (response.statusCode !== 200) return
          try {
            let end: number
            while ((end = buffer.indexOf('\n')) >= 0) {
              read(buffer.slice(0, end).trim())
              buffer = buffer.slice(end + 1)
            }
          } catch (error) {
            request.destroy(error as Error)
          }
        })
        response.on('end', () => {
          if (response.statusCode === 200) return resolve()
          let message = ''
          try {
            message = JSON.parse(buffer)?.error?.message ?? JSON.parse(buffer)?.[0]?.error?.message ?? ''
          } catch {
            message = buffer.slice(0, 200)
          }
          reject(new Error(`${model}: HTTP ${response.statusCode} ${message}`.slice(0, 300)))
        })
        response.on('error', reject)
      },
    )
    request.setTimeout(0)
    const timer = setTimeout(() => request.destroy(new Error(`${model}: no answer in ${timeout / 1000}s`)), timeout)
    request.on('close', () => clearTimeout(timer))
    request.on('error', reject)
    request.end(JSON.stringify({ contents: [{ parts }], generationConfig }))
  })
  if (!out.length) throw new Error(`${model}: empty answer (${finish})`)
  return { parts: out, tokens }
}

const GREEN_PROMPT = `Cut out the one product that this photo is selling and show only that product.
Remove the background, any person or mannequin, props, text and logos that are not on the product.
Keep the product's exact shape, colours, materials and details. Show the whole product, centred,
in a clear three-quarter view if the photo allows it, with even soft light and no shadow.
Fill the whole background with flat pure chroma-key green (#00FF00).`

const SPEC_PROMPT = (title: string) => `You are a 3D modeller. The image shows one product on a green screen: "${title}".
Build a faithful 3D model of this exact product from simple solids. The green background is not part of the product.

Answer with JSON only, in this form:
{ "parts": [ { "name": string, "shape": string, "params": object, "position": [x,y,z], "rotation": [x,y,z], "scale": [x,y,z],
               "color": "#rrggbb", "roughness": 0..1, "metalness": 0..1, "opacity": 0..1 } ] }

Rules:
- Units are metres at real-world size. +y is up, +z is the front, +x is the product's left as seen from the front.
- The product rests on the ground: its lowest point is at y = 0. Centre it on x = 0 and z = 0.
- "rotation" is in degrees, applied in x, y, z order, about the part's own centre. "scale" defaults to [1,1,1].
- Use 8 to 60 parts. Match the true proportions, silhouette, colours and materials (lenses: low roughness and opacity
  below 1; metal: metalness 1; fabric: roughness near 1). Model distinctive details, not only a block.
- Shapes and their params (every shape is centred on its own origin unless stated):
  - "box": { "size": [w,h,d] }
  - "sphere": { "radius": r }  (use "scale" to make an ellipsoid)
  - "cylinder": { "radiusTop": a, "radiusBottom": b, "height": h }  (axis along y; a cone has radiusTop 0)
  - "torus": { "radius": R, "tube": t, "arc": degrees }  (lies in the x-y plane; arc 360 is a full ring)
  - "capsule": { "radius": r, "length": l }  (axis along y)
  - "lathe": { "profile": [[r,y], ...] }  (points from bottom to top, revolved around the y axis)
  - "extrude": { "outline": [[x,y], ...], "holes": [[[x,y], ...]], "depth": d, "bevel": b }
      (a closed 2D outline in the x-y plane, extruded by "depth" along z and centred on z; "holes" and "bevel" are optional;
       use many outline points for curved silhouettes such as a lens rim, a shirt body or a sole)
  - "tube": { "path": [[x,y,z], ...], "radius": r, "closed": false }  (a smooth round tube through the points)
- Numbers only: no expressions, no comments, no trailing commas.`

const slug = (id: string) => id.split('/').pop()!.replace(/[^A-Za-z0-9_-]/g, '')

type Entry = { title: string; shop: string; neon?: string; argon?: string; seconds?: Record<string, number> }
const manifest: { products: Record<string, Entry> } = existsSync(MANIFEST)
  ? JSON.parse(await readFile(MANIFEST, 'utf8'))
  : { products: {} }
let saving = Promise.resolve()
const saveManifest = () =>
  (saving = saving.then(() => writeFile(MANIFEST, JSON.stringify(manifest, null, 2))))

async function greenScreen(imageUrl: string, file: string): Promise<{ mimeType: string; data: string }> {
  if (!force && existsSync(file)) return { mimeType: 'image/jpeg', data: (await readFile(file)).toString('base64') }
  const image = await retry(async () => {
    const response = await fetch(imageUrl, { signal: AbortSignal.timeout(30_000) })
    if (!response.ok) throw new Error(`product image: HTTP ${response.status}`)
    return response
  })
  const source = {
    mimeType: image.headers.get('content-type')?.split(';')[0] ?? 'image/jpeg',
    data: Buffer.from(await image.arrayBuffer()).toString('base64'),
  }
  const { parts } = await retry(() =>
    gemini(
      IMAGE_MODEL,
      [{ inlineData: source }, { text: GREEN_PROMPT }],
      { responseModalities: ['TEXT', 'IMAGE'] },
      IMAGE_TIMEOUT,
    ),
  )
  const cutout = parts.find((part) => part.inlineData)?.inlineData
  if (!cutout) throw new Error('image model returned no image')
  await writeFile(file, Buffer.from(cutout.data, 'base64'))
  return cutout
}

async function buildModel(name: string, title: string, cutout: { mimeType: string; data: string }, dir: string) {
  const started = Date.now()
  const { parts, tokens } = await retry(() => gemini(
    MODEL_IDS[name],
    [{ inlineData: cutout }, { text: SPEC_PROMPT(title) }],
    {
      responseMimeType: 'application/json',
      ...(thinking && name === 'neon' ? { thinkingConfig: { thinkingLevel: thinking } } : {}),
    },
    SPEC_TIMEOUT,
  ))
  const text = parts.map((part) => part.text ?? '').join('')
  const spec = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)) as ModelSpec
  await writeFile(path.join(dir, `${name}.json`), JSON.stringify(spec, null, 1))
  const { glb, parts: built, skipped } = await specToGlb(spec)
  await writeFile(path.join(dir, `${name}.glb`), glb)
  const seconds = Math.round((Date.now() - started) / 1000)
  return { seconds, tokens, built, skipped, bytes: glb.byteLength }
}

async function runProduct(shopTitle: string, id: string) {
  const entry = (manifest.products[id] ??= { title: '', shop: shopTitle })
  const todo = models.filter((name) => force || !entry[name as 'neon' | 'argon'])
  if (!todo.length) return console.log(`skip  ${shopTitle} / ${entry.title} (done)`)

  const { products } = await retry(() => lookupCatalog([id], { address_country: 'US' }))
  const product = products[0]
  const image = (product?.media ?? product?.variants[0]?.media ?? []).find((media) => media.type === 'image')
  if (!product || !image) throw new Error('no live product image')
  entry.title = product.title

  const dir = path.join(OUT, slug(id))
  await mkdir(dir, { recursive: true })
  const cutout = await greenScreen(image.url, path.join(dir, 'cutout.jpg'))

  await Promise.all(
    todo.map(async (name) => {
      try {
        const result = await buildModel(name, product.title, cutout, dir)
        entry[name as 'neon' | 'argon'] = `/generated/models/${slug(id)}/${name}.glb`
        ;(entry.seconds ??= {})[name] = result.seconds
        await saveManifest()
        console.log(
          `ok    ${shopTitle} / ${product.title.slice(0, 40)} / ${name}: ${result.built} parts` +
            `${result.skipped ? ` (${result.skipped} skipped)` : ''}, ${result.seconds}s, ${result.tokens ?? '?'} tokens, ${result.bytes} bytes`,
        )
      } catch (error) {
        console.log(`FAIL  ${shopTitle} / ${product.title.slice(0, 40)} / ${name}: ${String(error).slice(0, 200)}`)
      }
    }),
  )
}

const shops = shopArg === 'all' ? SHOPS : shopArg.split(',').map((index) => SHOPS[Number(index)]).filter(Boolean)
const jobs = shops.flatMap((shop) => shop.products.slice(0, limit).map((id) => ({ shop, id })))
console.log(`${jobs.length} products, models: ${models.join(', ')}, ${concurrency} at a time`)
await mkdir(OUT, { recursive: true })

let next = 0
await Promise.all(
  Array.from({ length: concurrency }, async () => {
    while (next < jobs.length) {
      const job = jobs[next++]
      try {
        await runProduct(job.shop.title, job.id)
      } catch (error) {
        console.log(`FAIL  ${job.shop.title} / ${job.id}: ${String(error).slice(0, 200)}`)
      }
    }
  }),
)
await saveManifest()
await saving
const done = Object.values(manifest.products)
console.log(`manifest: ${done.filter((e) => e.neon).length} neon, ${done.filter((e) => e.argon).length} argon models`)
