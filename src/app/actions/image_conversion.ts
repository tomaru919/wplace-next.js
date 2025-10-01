"use server"

import sharp from "sharp"

interface ImageData {
    data: Buffer | Uint8ClampedArray
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
        height: Math.max(adjustedHeight, blockSize)
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
                data[rightIdx] = Math.max(0, Math.min(255, data[rightIdx] + errR * 7 / 16))
                data[rightIdx + 1] = Math.max(0, Math.min(255, data[rightIdx + 1] + errG * 7 / 16))
                data[rightIdx + 2] = Math.max(0, Math.min(255, data[rightIdx + 2] + errB * 7 / 16))
            }

            if (y + 1 < height) {
                if (x > 0) {
                    const bottomLeftIdx = ((y + 1) * width + x - 1) * 4
                    data[bottomLeftIdx] = Math.max(0, Math.min(255, data[bottomLeftIdx] + errR * 3 / 16))
                    data[bottomLeftIdx + 1] = Math.max(0, Math.min(255, data[bottomLeftIdx + 1] + errG * 3 / 16))
                    data[bottomLeftIdx + 2] = Math.max(0, Math.min(255, data[bottomLeftIdx + 2] + errB * 3 / 16))
                }

                const bottomIdx = ((y + 1) * width + x) * 4
                data[bottomIdx] = Math.max(0, Math.min(255, data[bottomIdx] + errR * 5 / 16))
                data[bottomIdx + 1] = Math.max(0, Math.min(255, data[bottomIdx + 1] + errG * 5 / 16))
                data[bottomIdx + 2] = Math.max(0, Math.min(255, data[bottomIdx + 2] + errB * 5 / 16))

                if (x + 1 < width) {
                    const bottomRightIdx = ((y + 1) * width + x + 1) * 4
                    data[bottomRightIdx] = Math.max(0, Math.min(255, data[bottomRightIdx] + errR * 1 / 16))
                    data[bottomRightIdx + 1] = Math.max(0, Math.min(255, data[bottomRightIdx + 1] + errG * 1 / 16))
                    data[bottomRightIdx + 2] = Math.max(0, Math.min(255, data[bottomRightIdx + 2] + errB * 1 / 16))
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
export async function imageConversion(
    imageSrc: string,
    palette: number[][],
    blockSize: number,
    isDither: boolean,
    isNoPixelate: boolean
): Promise<string> {
    const imageBuffer = Buffer.from(imageSrc.split(',')[1], 'base64')
    const image = sharp(imageBuffer)
    const metadata = await image.metadata()

    const originalWidth = metadata.width || 0
    const originalHeight = metadata.height || 0

    // Adjust image size to be divisible by the block size
    const adjustedSize = adjustImageSize(originalWidth, originalHeight, blockSize)

    let sharpInstance = image.resize(adjustedSize.width, adjustedSize.height, {
        fit: 'cover',
        position: 'center'
    })

    // Pixelate if required
    if (!isNoPixelate) {
        const smallWidth = Math.max(1, Math.floor(adjustedSize.width / blockSize))
        const smallHeight = Math.max(1, Math.floor(adjustedSize.height / blockSize))

        // Resize down and get an intermediate buffer to break the optimization chain
        const smallImageBuffer = await sharpInstance
            .resize(smallWidth, smallHeight, { kernel: 'nearest' })
            .toBuffer()

        // Create a new sharp instance from the small buffer and resize back up
        sharpInstance = sharp(smallImageBuffer)
            .resize(adjustedSize.width, adjustedSize.height, { kernel: 'nearest' })
    }

    // Get image data for quantization/dithering
    const { data, info } = await sharpInstance.ensureAlpha().raw().toBuffer({ resolveWithObject: true })

    const imageData: ImageData = { data, width: info.width, height: info.height }

    // Make semi-transparent pixels fully transparent
    fullTransparent(imageData)

    let processedImageData: ImageData

    if (isDither) {
        processedImageData = floydSteinbergDither(imageData, palette)
    } else {
        processedImageData = quantizeToNearestColor(imageData, palette)
    }

    const finalImageBuffer = await sharp(processedImageData.data, {
        raw: {
            width: processedImageData.width,
            height: processedImageData.height,
            channels: 4
        }
    }).png().toBuffer()

    return `data:image/png;base64,${finalImageBuffer.toString('base64')}`
}
