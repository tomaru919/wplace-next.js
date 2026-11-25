import initWasm, { convert } from "@/lib/wasm/image_conversion"

export interface ConversionOptions {
  /** パレット色の RGB 配列（例: [[0, 0, 0], [255, 255, 255]]） */
  palette: number[][]
  blockSize: number
  isDither: boolean
  isNoPixelate: boolean
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
 * 画像ファイルをブラウザ上で変換し、結果を描いた canvas を返す。
 *
 * 1. ブラウザの機能で画像をデコードし、canvas でリサイズ・中央切り抜き（cover）
 * 2. canvas から RGBA ピクセル配列を取り出し、WebAssembly（Rust）でピクセル化・減色・ディザリング
 * 3. 結果を canvas に書き戻す
 */
export async function convertImage(file: Blob, options: ConversionOptions): Promise<HTMLCanvasElement> {
  // .wasm の読み込み。2 回目以降は読み込み済みのものがそのまま使われる
  await initWasm()

  const bitmap = await createImageBitmap(file)
  const { width, height } = adjustImageSize(bitmap.width, bitmap.height, options.blockSize)

  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext("2d", { willReadFrequently: true })
  if (!ctx) throw new Error("canvas の 2D コンテキストを取得できませんでした")

  // cover: アスペクト比を保ったまま canvas 全体を覆うように描き、はみ出た部分は中央で切り抜く
  // drawImage(画像, 切り出し元 x, y, 幅, 高さ, 描画先 x, y, 幅, 高さ)
  const scale = Math.max(width / bitmap.width, height / bitmap.height)
  const srcWidth = width / scale
  const srcHeight = height / scale
  ctx.imageSmoothingQuality = "high"
  ctx.drawImage(
    bitmap,
    (bitmap.width - srcWidth) / 2,
    (bitmap.height - srcHeight) / 2,
    srcWidth,
    srcHeight,
    0,
    0,
    width,
    height,
  )
  bitmap.close()

  const imageData = ctx.getImageData(0, 0, width, height)
  // ImageData.data は Uint8ClampedArray。同じメモリを Uint8Array として見るビューを作って渡す（コピーなし）
  const pixels = new Uint8Array(imageData.data.buffer, imageData.data.byteOffset, imageData.data.byteLength)

  convert(
    pixels,
    width,
    height,
    Uint8Array.from(options.palette.flat()),
    options.blockSize,
    options.isDither,
    options.isNoPixelate,
  )

  ctx.putImageData(imageData, 0, 0)
  return canvas
}
