import * as THREE from 'three/webgpu'
import { shelfOrder } from './clicks'
import { canvasTexture, oakTexture } from './hallway'
import { lookupCatalog, type Product } from './shop'
import type { ShopRoom } from './shopRoom'
import type { Stage } from './stage'

/**
 * Placeholder products: one small cube for each pinned product, on a shelf on
 * the shop's back wall, with the product photo on the cube's front face. Real
 * 3D models replace the cubes later.
 */
const SLOTS = 6
const CUBE = 0.5
const SPACING = 0.84
const SHELF_TOP = 1.17
const TEXTURE_SIZE = 512

export interface ShelfProduct {
  id: string
  title: string
  /** For example "$58.00". Empty when the product has no price. */
  price: string
  /** The shop's own checkout or product page for this product. Used unchanged. */
  buyUrl: string | null
  /** The product photo as a JPEG data URL, or null when the photo did not load. */
  image: () => string | null
}

export interface ShelfCubes {
  /** Put this shop's products on the cubes. */
  setShop: (shop: number) => void
  /** The product on the cube at this screen position, or null. */
  productAt: (x: number, y: number) => ShelfProduct | null
}

function priceLabel(product: Product): string {
  const price = product.variants[0]?.price ?? product.price_range?.min
  if (!price) return ''
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: price.currency }).format(price.amount / 100)
  } catch {
    return ''
  }
}

function photoUrl(product: Product): string | null {
  const media = [...(product.media ?? []), ...(product.variants[0]?.media ?? [])]
  return media.find((item) => item.type === 'image')?.url ?? null
}

/** The cube front: the photo, whole, on white. Without a photo: the title. */
function faceTexture(title: string, photo?: HTMLImageElement): THREE.CanvasTexture {
  return canvasTexture(TEXTURE_SIZE, TEXTURE_SIZE, (g) => {
    g.fillStyle = '#ffffff'
    g.fillRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE)
    if (photo) {
      const room = TEXTURE_SIZE * 0.94
      const scale = Math.min(room / photo.naturalWidth, room / photo.naturalHeight)
      const width = photo.naturalWidth * scale
      const height = photo.naturalHeight * scale
      g.drawImage(photo, (TEXTURE_SIZE - width) / 2, (TEXTURE_SIZE - height) / 2, width, height)
      return
    }
    g.fillStyle = '#2b2925'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.font = '300 34px "Helvetica Neue", system-ui, sans-serif'
    const words = title.split(/\s+/)
    const lines: string[] = []
    for (const word of words) {
      const last = lines[lines.length - 1]
      if (last !== undefined && g.measureText(`${last} ${word}`).width < TEXTURE_SIZE * 0.8) lines[lines.length - 1] = `${last} ${word}`
      else lines.push(word)
    }
    lines.slice(0, 6).forEach((line, i, all) => g.fillText(line, TEXTURE_SIZE / 2, TEXTURE_SIZE / 2 + (i - (all.length - 1) / 2) * 44))
  })
}

export function createShelfCubes(stage: Stage, room: ShopRoom): ShelfCubes {
  // The back wall's inner face, in the room's own coordinates.
  const wallZ = -(room.entryZ - room.center.z + 1.2)
  const group = new THREE.Group()
  group.name = 'shelf-cubes'
  room.group.add(group)

  const oak = new THREE.MeshStandardMaterial({ map: oakTexture(), roughness: 0.5 })
  const shelf = new THREE.Mesh(new THREE.BoxGeometry(SLOTS * SPACING + 0.2, 0.07, 0.62), oak)
  shelf.position.set(0, SHELF_TOP - 0.035, wallZ + 0.31)
  shelf.castShadow = shelf.receiveShadow = true
  group.add(shelf)

  const paper = new THREE.MeshStandardMaterial({ color: 0xf4efe6, roughness: 0.85 })
  const geometry = new THREE.BoxGeometry(CUBE, CUBE, CUBE)
  const cubes: THREE.Mesh[] = []
  const fronts: THREE.MeshStandardMaterial[] = []
  const products: (ShelfProduct | null)[] = []
  for (let slot = 0; slot < SLOTS; slot++) {
    const front = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7 })
    // Box faces: +x, -x, +y, -y, +z, -z. The +z face looks into the room.
    const cube = new THREE.Mesh(geometry, [paper, paper, paper, paper, front, paper])
    cube.position.set((slot - (SLOTS - 1) / 2) * SPACING, SHELF_TOP + CUBE / 2, wallZ + 0.33)
    cube.castShadow = cube.receiveShadow = true
    cube.visible = false
    group.add(cube)
    cubes.push(cube)
    fronts.push(front)
    products.push(null)
  }

  const setFace = (slot: number, texture: THREE.CanvasTexture | null) => {
    fronts[slot].map?.dispose()
    fronts[slot].map = texture
    fronts[slot].needsUpdate = true
    stage.invalidate()
  }

  // Each visit gets a new number, so a slow answer for an earlier shop is dropped.
  let visit = 0
  const setShop = (shop: number) => {
    const current = ++visit
    for (let slot = 0; slot < SLOTS; slot++) {
      cubes[slot].visible = false
      products[slot] = null
      setFace(slot, null)
    }
    void (async () => {
      const ids = (await shelfOrder(shop)).slice(0, SLOTS)
      if (ids.length === 0 || current !== visit) return
      const { products: found } = await lookupCatalog(ids)
      if (current !== visit) return
      ids.forEach((id, slot) => {
        const product = found.find((item) => item.id === id) ?? found[slot]
        if (!product) return
        let canvas: HTMLCanvasElement | null = null
        products[slot] = {
          id,
          title: product.title,
          price: priceLabel(product),
          buyUrl: product.variants[0]?.checkout_url ?? product.variants[0]?.url ?? null,
          image: () => {
            try {
              return canvas?.toDataURL('image/jpeg', 0.9) ?? null
            } catch {
              return null
            }
          },
        }
        cubes[slot].visible = true
        setFace(slot, faceTexture(product.title))
        const url = photoUrl(product)
        if (!url) return
        // The photo comes straight from the shop's image server. It needs CORS to go on a canvas.
        const photo = new Image()
        photo.crossOrigin = 'anonymous'
        photo.onload = () => {
          if (current !== visit || photo.naturalWidth === 0) return
          const texture = faceTexture(product.title, photo)
          canvas = texture.image as HTMLCanvasElement
          setFace(slot, texture)
        }
        photo.src = url
      })
    })().catch(() => {})
  }

  const raycaster = new THREE.Raycaster()
  const pointer = new THREE.Vector2()
  const productAt = (x: number, y: number) => {
    if (!room.group.visible) return null
    const canvas = stage.renderer.domElement
    pointer.set((x / canvas.clientWidth) * 2 - 1, -(y / canvas.clientHeight) * 2 + 1)
    stage.camera.updateMatrixWorld()
    raycaster.setFromCamera(pointer, stage.camera)
    const hit = raycaster.intersectObjects(cubes.filter((cube) => cube.visible), false)[0]
    return hit ? products[cubes.indexOf(hit.object as THREE.Mesh)] : null
  }

  return { setShop, productAt }
}
