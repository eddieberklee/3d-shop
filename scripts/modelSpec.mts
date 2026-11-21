/**
 * Turn a model "spec" (a list of simple solids, written by a language model)
 * into a binary glTF file. Bad parts are skipped, not fatal.
 */
import * as THREE from 'three'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'

export interface SpecPart {
  name?: string
  shape: string
  params?: Record<string, unknown>
  position?: number[]
  rotation?: number[]
  scale?: number[]
  color?: string
  roughness?: number
  metalness?: number
  opacity?: number
}
export interface ModelSpec {
  parts: SpecPart[]
}

// GLTFExporter reads its binary output through the browser's FileReader.
if (!('FileReader' in globalThis)) {
  class NodeFileReader {
    result: ArrayBuffer | string | null = null
    onloadend: (() => void) | null = null
    readAsArrayBuffer(blob: Blob) {
      void blob.arrayBuffer().then((buffer) => {
        this.result = buffer
        this.onloadend?.()
      })
    }
    readAsDataURL(blob: Blob) {
      void blob.arrayBuffer().then((buffer) => {
        this.result = `data:${blob.type};base64,${Buffer.from(buffer).toString('base64')}`
        this.onloadend?.()
      })
    }
  }
  Object.assign(globalThis, { FileReader: NodeFileReader })
}

const number = (value: unknown, fallback: number) =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback
const positive = (value: unknown, fallback: number) => Math.max(number(value, fallback), 0.0005)
const points = (value: unknown, size: number): number[][] =>
  Array.isArray(value)
    ? value.filter(
        (point): point is number[] =>
          Array.isArray(point) && point.length >= size && point.every((n) => Number.isFinite(n)),
      )
    : []
const vector = (value: unknown, fallback: number): [number, number, number] => {
  const list = Array.isArray(value) ? value : []
  return [number(list[0], fallback), number(list[1], fallback), number(list[2], fallback)]
}

function geometry(part: SpecPart): THREE.BufferGeometry | null {
  const p = part.params ?? {}
  switch (part.shape) {
    case 'box': {
      const [w, h, d] = vector(p.size, 0.05)
      return new THREE.BoxGeometry(Math.abs(w) || 0.001, Math.abs(h) || 0.001, Math.abs(d) || 0.001)
    }
    case 'sphere':
      return new THREE.SphereGeometry(positive(p.radius, 0.05), 32, 20)
    case 'cylinder':
    case 'cone':
      return new THREE.CylinderGeometry(
        Math.max(number(p.radiusTop, part.shape === 'cone' ? 0 : 0.05), 0),
        Math.max(number(p.radiusBottom, 0.05), 0),
        positive(p.height, 0.1),
        40,
      )
    case 'torus':
      return new THREE.TorusGeometry(
        positive(p.radius, 0.05),
        positive(p.tube, 0.005),
        16,
        64,
        THREE.MathUtils.degToRad(THREE.MathUtils.clamp(number(p.arc, 360), 1, 360)),
      )
    case 'capsule':
      return new THREE.CapsuleGeometry(positive(p.radius, 0.02), positive(p.length, 0.1), 8, 24)
    case 'lathe': {
      const profile = points(p.profile, 2).map(([r, y]) => new THREE.Vector2(Math.max(r, 0), y))
      return profile.length >= 2 ? new THREE.LatheGeometry(profile, 48) : null
    }
    case 'extrude': {
      const outline = points(p.outline, 2)
      if (outline.length < 3) return null
      const shape = new THREE.Shape(outline.map(([x, y]) => new THREE.Vector2(x, y)))
      for (const hole of Array.isArray(p.holes) ? p.holes : []) {
        const ring = points(hole, 2)
        if (ring.length >= 3) shape.holes.push(new THREE.Path(ring.map(([x, y]) => new THREE.Vector2(x, y))))
      }
      const depth = positive(p.depth, 0.01)
      const bevel = THREE.MathUtils.clamp(number(p.bevel, 0), 0, depth / 2)
      const extruded = new THREE.ExtrudeGeometry(shape, {
        depth: depth - bevel * 2,
        bevelEnabled: bevel > 0,
        bevelThickness: bevel,
        bevelSize: bevel,
        bevelSegments: 3,
        curveSegments: 12,
      })
      // Centre on z: the extrusion starts at z = 0 (minus the bevel).
      extruded.translate(0, 0, -(depth - bevel * 2) / 2)
      return extruded
    }
    case 'tube': {
      const path = points(p.path, 3).map(([x, y, z]) => new THREE.Vector3(x, y, z))
      if (path.length < 2) return null
      const curve = new THREE.CatmullRomCurve3(path, p.closed === true)
      return new THREE.TubeGeometry(curve, Math.min(path.length * 12, 240), positive(p.radius, 0.003), 12, p.closed === true)
    }
    default:
      return null
  }
}

export async function specToGlb(spec: ModelSpec): Promise<{ glb: Buffer; parts: number; skipped: number }> {
  const scene = new THREE.Scene()
  let skipped = 0
  for (const part of Array.isArray(spec.parts) ? spec.parts.slice(0, 120) : []) {
    let shape: THREE.BufferGeometry | null = null
    try {
      shape = geometry(part)
    } catch {
      shape = null
    }
    const hasNaN = shape && Array.from(shape.getAttribute('position').array).some((n) => !Number.isFinite(n))
    if (!shape || hasNaN) {
      skipped++
      continue
    }
    const opacity = THREE.MathUtils.clamp(number(part.opacity, 1), 0.05, 1)
    let color: THREE.Color
    try {
      color = new THREE.Color(typeof part.color === 'string' ? part.color : '#b0b0b0')
    } catch {
      color = new THREE.Color('#b0b0b0')
    }
    const mesh = new THREE.Mesh(
      shape,
      new THREE.MeshStandardMaterial({
        color,
        roughness: THREE.MathUtils.clamp(number(part.roughness, 0.6), 0, 1),
        metalness: THREE.MathUtils.clamp(number(part.metalness, 0), 0, 1),
        opacity,
        transparent: opacity < 1,
        side: THREE.DoubleSide,
      }),
    )
    mesh.name = String(part.name ?? part.shape).slice(0, 60)
    mesh.position.set(...vector(part.position, 0))
    const [rx, ry, rz] = vector(part.rotation, 0)
    mesh.rotation.set(THREE.MathUtils.degToRad(rx), THREE.MathUtils.degToRad(ry), THREE.MathUtils.degToRad(rz), 'XYZ')
    const [sx, sy, sz] = vector(part.scale, 1)
    mesh.scale.set(sx || 1, sy || 1, sz || 1)
    scene.add(mesh)
  }
  if (!scene.children.length) throw new Error('the spec has no usable parts')

  const glb = (await new GLTFExporter().parseAsync(scene, { binary: true })) as ArrayBuffer
  return { glb: Buffer.from(glb), parts: scene.children.length, skipped }
}
