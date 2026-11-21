/**
 * The try-on call to Gemini. Web-standard code only (fetch), so the dev server
 * (`server/tryOn.ts`) and the Cloudflare Worker (`worker/index.ts`) share it.
 */

/** Google's premium image model ("Nano Banana Pro"). */
const MODEL = 'gemini-3-pro-image'
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`
export const MAX_BODY_BYTES = 12 * 1024 * 1024
const TIMEOUT_MS = 150_000

export interface InlineImage {
  mimeType: string
  data: string
}

export function parseDataUrl(value: unknown): InlineImage | null {
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

/** Check a request body, then make the picture. Throws `BadRequest` for a body that is not valid. */
export class BadRequest extends Error {}

export async function tryOnFromBody(apiKey: string, text: string): Promise<string> {
  let body: { selfie?: unknown; product?: unknown; title?: unknown }
  try {
    body = JSON.parse(text)
  } catch {
    throw new BadRequest('bad request')
  }
  const selfie = parseDataUrl(body?.selfie)
  const product = parseDataUrl(body?.product)
  if (!selfie || !product) throw new BadRequest('selfie and product must be image data URLs')
  const title = typeof body.title === 'string' ? body.title.replace(/["\n\r]/g, ' ').slice(0, 200) : 'product'
  try {
    return await generateTryOn(apiKey, selfie, product, title)
  } catch (error) {
    throw new Error((error as Error).name === 'TimeoutError' ? 'The image model took too long.' : (error as Error).message)
  }
}
