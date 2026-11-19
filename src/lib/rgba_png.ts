import { deflateSync, inflateSync } from "node:zlib"

/**
 * 8bit RGBA（color type 6）・非インターレースの PNG だけを扱う最小限のデコーダー／エンコーダー。
 *
 * Bun.Image は生ピクセル（raw）の入出力に対応していないため、
 * 「Bun.Image で PNG にする → ここで RGBA 配列に戻す」「RGBA 配列 → ここで PNG にする」という形で橋渡しする。
 * Bun.Image の PNG 出力は入力形式に関係なく常に 8bit RGBA になるので、その形式だけ対応すれば十分。
 */

export interface RgbaImage {
  data: Uint8Array
  width: number
  height: number
}

const PNG_SIGNATURE = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const BYTES_PER_PIXEL = 4

/** PNG バイト列を RGBA のピクセル配列に変換する */
export function decodeRgbaPng(png: Uint8Array): RgbaImage {
  if (!PNG_SIGNATURE.every((byte, i) => png[i] === byte)) {
    throw new Error("PNG ではありません")
  }

  const view = new DataView(png.buffer, png.byteOffset, png.byteLength)
  let width = 0
  let height = 0
  const idatChunks: Uint8Array[] = []

  // チャンク構造: [長さ 4byte][種類 4byte][データ][CRC 4byte]
  let offset = PNG_SIGNATURE.length
  while (offset < png.length) {
    const length = view.getUint32(offset)
    const type = String.fromCharCode(...png.subarray(offset + 4, offset + 8))
    const data = png.subarray(offset + 8, offset + 8 + length)

    if (type === "IHDR") {
      width = view.getUint32(offset + 8)
      height = view.getUint32(offset + 12)
      const [bitDepth, colorType, , , interlace] = data.subarray(8, 13)
      if (bitDepth !== 8 || colorType !== 6 || interlace !== 0) {
        throw new Error(`未対応の PNG 形式です (bitDepth=${bitDepth}, colorType=${colorType}, interlace=${interlace})`)
      }
    } else if (type === "IDAT") {
      idatChunks.push(data)
    } else if (type === "IEND") {
      break
    }
    offset += 12 + length
  }

  // 画像データは複数の IDAT に分割されていることがあるので、連結してから zlib 展開する
  const raw = inflateSync(Buffer.concat(idatChunks))
  const stride = width * BYTES_PER_PIXEL
  const pixels = new Uint8Array(stride * height)

  // 各行の先頭 1byte は「フィルター種別」。フィルターを逆算して元のピクセル値に戻す
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)]
    const src = y * (stride + 1) + 1
    const dst = y * stride
    const prev = dst - stride // 1 行上（y=0 のときは使わない）

    for (let x = 0; x < stride; x++) {
      const a = x >= BYTES_PER_PIXEL ? pixels[dst + x - BYTES_PER_PIXEL] : 0 // 左
      const b = y > 0 ? pixels[prev + x] : 0 // 上
      const c = x >= BYTES_PER_PIXEL && y > 0 ? pixels[prev + x - BYTES_PER_PIXEL] : 0 // 左上

      let predictor: number
      switch (filter) {
        case 0: // None
          predictor = 0
          break
        case 1: // Sub
          predictor = a
          break
        case 2: // Up
          predictor = b
          break
        case 3: // Average
          predictor = (a + b) >> 1
          break
        case 4: // Paeth
          predictor = paeth(a, b, c)
          break
        default:
          throw new Error(`不正なフィルター種別です: ${filter}`)
      }
      pixels[dst + x] = (raw[src + x] + predictor) & 0xff
    }
  }

  return { data: pixels, width, height }
}

/** RGBA のピクセル配列を PNG バイト列に変換する */
export function encodeRgbaPng({
  data,
  width,
  height,
}: {
  data: Uint8Array | Uint8ClampedArray
  width: number
  height: number
}): Buffer {
  const stride = width * BYTES_PER_PIXEL
  // 各行の先頭にフィルター種別 0（None）を付けて並べる
  const raw = new Uint8Array((stride + 1) * height)
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0
    raw.set(data.subarray(y * stride, (y + 1) * stride), y * (stride + 1) + 1)
  }

  const ihdr = new Uint8Array(13)
  const ihdrView = new DataView(ihdr.buffer)
  ihdrView.setUint32(0, width)
  ihdrView.setUint32(4, height)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // color type: RGBA
  // [10] 圧縮方式, [11] フィルター方式, [12] インターレース はすべて 0

  return Buffer.concat([
    PNG_SIGNATURE,
    createChunk("IHDR", ihdr),
    createChunk("IDAT", deflateSync(raw)),
    createChunk("IEND", new Uint8Array(0)),
  ])
}

function createChunk(type: string, data: Uint8Array): Uint8Array {
  const chunk = new Uint8Array(12 + data.length)
  const view = new DataView(chunk.buffer)
  view.setUint32(0, data.length)
  chunk.set(new TextEncoder().encode(type), 4)
  chunk.set(data, 8)
  // CRC は「種類 + データ」に対して計算する
  view.setUint32(8 + data.length, Bun.hash.crc32(chunk.subarray(4, 8 + data.length)))
  return chunk
}

/** Paeth フィルターの予測値: 左・上・左上のうち a + b - c に最も近いものを選ぶ */
function paeth(a: number, b: number, c: number) {
  const p = a + b - c
  const pa = Math.abs(p - a)
  const pb = Math.abs(p - b)
  const pc = Math.abs(p - c)
  if (pa <= pb && pa <= pc) return a
  if (pb <= pc) return b
  return c
}
