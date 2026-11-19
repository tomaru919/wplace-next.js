"use server"

import { decodeRgbaPng, encodeRgbaPng } from "@/lib/rgba_png"

interface ImageData {
  data: Uint8Array | Uint8ClampedArray
  width: number
  height: number
}

/** 画像サイズをブロックサイズで割り切れるように調整 */
function adjustImageSize(originalWidth: number, originalHeight: number, blockSize: number) {
  const adjustedWidth = Math.floor(originalWidth / blockSize) * blockSize
  const adjustedHeight = Math.floor(originalHeight / blockSize) * blockSize

  // 最小サイズを保証（少なくとも1ブロック分）
  return {
    width: Math.max(adjustedWidth, blockSize),
    height: Math.max(adjustedHeight, blockSize),
  }
}

/**
 * アスペクト比を保ったまま target を覆う大きさに拡大縮小し、中央を切り抜く（sharp の fit: "cover" 相当）
 * Bun.Image には切り抜き機能がないため、拡大縮小だけ Bun.Image で行い、切り抜きは RGBA 配列上で行う。
 */
async function resizeCover(imageBuffer: Uint8Array, targetWidth: number, targetHeight: number): Promise<ImageData> {
  const { width: srcWidth, height: srcHeight } = await new Bun.Image(imageBuffer).metadata()

  // 縦横どちらも target 以上になる倍率を選ぶ
  const scale = Math.max(targetWidth / srcWidth, targetHeight / srcHeight)
  const resizedWidth = Math.max(targetWidth, Math.round(srcWidth * scale))
  const resizedHeight = Math.max(targetHeight, Math.round(srcHeight * scale))

  // Bun.Image は生ピクセルを出力できないので、無圧縮 PNG を経由して RGBA 配列に戻す
  const png = await new Bun.Image(imageBuffer).resize(resizedWidth, resizedHeight).png({ compressionLevel: 0 }).bytes()
  const resized = decodeRgbaPng(png)

  const left = Math.floor((resized.width - targetWidth) / 2)
  const top = Math.floor((resized.height - targetHeight) / 2)
  const cropped = new Uint8Array(targetWidth * targetHeight * 4)
  for (let y = 0; y < targetHeight; y++) {
    const srcStart = ((top + y) * resized.width + left) * 4
    cropped.set(resized.data.subarray(srcStart, srcStart + targetWidth * 4), y * targetWidth * 4)
  }

  return { data: cropped, width: targetWidth, height: targetHeight }
}

/**
 * ブロックごとに中央のピクセル色で塗りつぶしてドット絵風にする
 * （sharp で「nearest で縮小 → nearest で拡大」していた処理と同じ効果）
 */
function pixelate(imageData: ImageData, blockSize: number) {
  const { data, width, height } = imageData
  const half = Math.floor(blockSize / 2)

  for (let by = 0; by < height; by += blockSize) {
    for (let bx = 0; bx < width; bx += blockSize) {
      const sampleIdx = ((by + half) * width + (bx + half)) * 4
      const color = data.slice(sampleIdx, sampleIdx + 4)

      for (let y = by; y < by + blockSize; y++) {
        for (let x = bx; x < bx + blockSize; x++) {
          data.set(color, (y * width + x) * 4)
        }
      }
    }
  }
}

/** 透明部分を完全に透明化 */
function fullTransparent(imageData: ImageData) {
  const data = imageData.data
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 255) {
      data[i + 3] = 0 // Make fully transparent
    }
  }
}

/**
 * Finds the nearest color in the palette. (Server-side compatible)
 */
function findNearestPaletteColor(r: number, g: number, b: number, palette: number[][]) {
  let minDistance = Infinity
  let nearestColor = palette[0]

  for (const color of palette) {
    const distance = (r - color[0]) ** 2 + (g - color[1]) ** 2 + (b - color[2]) ** 2
    if (distance < minDistance) {
      minDistance = distance
      nearestColor = color
    }
  }
  return nearestColor
}

/**
 * Applies Floyd-Steinberg dithering. (Server-side compatible)
 * @returns A new ImageData object.
 */
function floydSteinbergDither(imageData: ImageData, palette: number[][]): ImageData {
  const data = new Uint8ClampedArray(imageData.data)
  const width = imageData.width
  const height = imageData.height

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4

      if (data[idx + 3] === 0) continue // Skip transparent pixels

      const oldR = data[idx]
      const oldG = data[idx + 1]
      const oldB = data[idx + 2]

      const [newR, newG, newB] = findNearestPaletteColor(oldR, oldG, oldB, palette)

      data[idx] = newR
      data[idx + 1] = newG
      data[idx + 2] = newB

      const errR = oldR - newR
      const errG = oldG - newG
      const errB = oldB - newB

      // Error diffusion
      if (x + 1 < width) {
        const rightIdx = (y * width + x + 1) * 4
        data[rightIdx] = Math.max(0, Math.min(255, data[rightIdx] + (errR * 7) / 16))
        data[rightIdx + 1] = Math.max(0, Math.min(255, data[rightIdx + 1] + (errG * 7) / 16))
        data[rightIdx + 2] = Math.max(0, Math.min(255, data[rightIdx + 2] + (errB * 7) / 16))
      }

      if (y + 1 < height) {
        if (x > 0) {
          const bottomLeftIdx = ((y + 1) * width + x - 1) * 4
          data[bottomLeftIdx] = Math.max(0, Math.min(255, data[bottomLeftIdx] + (errR * 3) / 16))
          data[bottomLeftIdx + 1] = Math.max(0, Math.min(255, data[bottomLeftIdx + 1] + (errG * 3) / 16))
          data[bottomLeftIdx + 2] = Math.max(0, Math.min(255, data[bottomLeftIdx + 2] + (errB * 3) / 16))
        }

        const bottomIdx = ((y + 1) * width + x) * 4
        data[bottomIdx] = Math.max(0, Math.min(255, data[bottomIdx] + (errR * 5) / 16))
        data[bottomIdx + 1] = Math.max(0, Math.min(255, data[bottomIdx + 1] + (errG * 5) / 16))
        data[bottomIdx + 2] = Math.max(0, Math.min(255, data[bottomIdx + 2] + (errB * 5) / 16))

        if (x + 1 < width) {
          const bottomRightIdx = ((y + 1) * width + x + 1) * 4
          data[bottomRightIdx] = Math.max(0, Math.min(255, data[bottomRightIdx] + (errR * 1) / 16))
          data[bottomRightIdx + 1] = Math.max(0, Math.min(255, data[bottomRightIdx + 1] + (errG * 1) / 16))
          data[bottomRightIdx + 2] = Math.max(0, Math.min(255, data[bottomRightIdx + 2] + (errB * 1) / 16))
        }
      }
    }
  }

  const newImageData: ImageData = { data: data, width, height }
  return newImageData
}

/**
 * Quantizes image to the nearest colors in the palette. (Server-side compatible)
 * @returns The modified ImageData object.
 */
function quantizeToNearestColor(imageData: ImageData, palette: number[][]): ImageData {
  const data = imageData.data

  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue // Skip transparent pixels

    const [r, g, b] = findNearestPaletteColor(data[i], data[i + 1], data[i + 2], palette)
    data[i] = r
    data[i + 1] = g
    data[i + 2] = b
  }

  return imageData
}

/**
 * Converts an image by resizing, pixelating, and applying color quantization or dithering.
 */
export default async function imageConversion(formData: FormData) {
  const imageFile = formData.get("image") as File
  const palette = JSON.parse(formData.get("palette") as string) as number[][]
  const blockSize = parseInt(formData.get("blockSize") as string, 10)
  const isDither = formData.get("isDither") === "true"
  const isNoPixelate = formData.get("isNoPixelate") === "true"

  const imageBuffer = new Uint8Array(await imageFile.arrayBuffer())
  const { width: originalWidth, height: originalHeight } = await new Bun.Image(imageBuffer).metadata()

  // Adjust image size to be divisible by the block size
  const adjustedSize = adjustImageSize(originalWidth, originalHeight, blockSize)

  // Resize (cover, centered) and get RGBA pixels
  const imageData = await resizeCover(imageBuffer, adjustedSize.width, adjustedSize.height)

  // Pixelate if required
  if (!isNoPixelate && blockSize > 1) {
    pixelate(imageData, blockSize)
  }

  // Make semi-transparent pixels fully transparent
  fullTransparent(imageData)

  let processedImageData: ImageData

  if (isDither) {
    processedImageData = floydSteinbergDither(imageData, palette)
  } else {
    processedImageData = quantizeToNearestColor(imageData, palette)
  }

  const finalImageBuffer = encodeRgbaPng(processedImageData)

  return `data:image/png;base64,${finalImageBuffer.toString("base64")}`
}
