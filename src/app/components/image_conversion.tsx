"use client"

import Link from "next/link"
import { useCallback, useEffect, useRef, useState } from "react"
import { SelectColorsModal } from "@/app/components/select_colors_modal"
import imageConversion from "@/app/actions/image_conversion"
import ThemeToggle from "@/app/components/theme_toggle"
import { useTheme } from "@/lib/theme_provider"
import { COLOR_NAME_MAP, DEFAULT_COLORS, SELECTABLE_COLORS } from "@/lib/palette"

function ImagePreview({
  processedCanvas,
  currentBlockSize,
  isSidebarOpen,
}: Readonly<{
  processedCanvas: HTMLCanvasElement
  currentBlockSize: number
  isSidebarOpen: boolean
}>) {
  const [zoomLevel, setZoomLevel] = useState(1)
  const [colorInfo, setColorInfo] = useState({
    show: false,
    text: "",
  })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [canvasPosition, setCanvasPosition] = useState({ x: 0, y: 0 })
  const [initialPosition, setInitialPosition] = useState({ x: 0, y: 0 })

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)

  const { theme } = useTheme()

  /** グリッド描画 */
  function drawGrid(ctx: CanvasRenderingContext2D, width: number, height: number) {
    ctx.strokeStyle = "#000000"
    ctx.lineWidth = 0.2

    const pixelSize = currentBlockSize * zoomLevel

    if (pixelSize < 4) return // グリッドが細かすぎる場合は描画しない

    // 縦線
    for (let x = 0; x <= width; x += pixelSize) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, height)
      ctx.stroke()
    }

    // 横線
    for (let y = 0; y <= height; y += pixelSize) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(width, y)
      ctx.stroke()
    }

    ctx.globalAlpha = 1
  }

  /**チェッカーボード描画 */
  function drawCheckerboard(ctx: CanvasRenderingContext2D, width: number, height: number) {
    const size = zoomLevel * 8

    let color1: string
    let color2: string

    if (theme === "dark") {
      color1 = "#25292e"
      color2 = "#141414"
    } else {
      color1 = "#e6e6e6"
      color2 = "#ffffff"
    }

    for (let y = 0; y < height; y += size) {
      for (let x = 0; x < width; x += size) {
        ctx.fillStyle = (x / size) % 2 === (y / size) % 2 ? color1 : color2
        ctx.fillRect(x, y, size, size)
      }
    }
  }

  /** キャンバスを描画 */
  // biome-ignore lint/correctness/useExhaustiveDependencies: false positive, dependencies are handled correctly
  const drawCanvas = useCallback(() => {
    if (!processedCanvas || !canvasRef.current) return

    const ctx = canvasRef.current.getContext("2d")
    if (!ctx) return

    const sourceCanvas = processedCanvas

    const displayWidth = sourceCanvas.width * zoomLevel
    const displayHeight = sourceCanvas.height * zoomLevel

    canvasRef.current.width = displayWidth
    canvasRef.current.height = displayHeight

    drawCheckerboard(ctx, displayWidth, displayHeight)

    ctx.imageSmoothingEnabled = false
    ctx.drawImage(sourceCanvas, 0, 0, displayWidth, displayHeight)

    if (zoomLevel >= 2) {
      drawGrid(ctx, displayWidth, displayHeight)
    }
  }, [processedCanvas, zoomLevel, theme])

  /** カラー情報取得 */
  function getPixelColor(x: number, y: number) {
    if (!processedCanvas) return null

    const canvas = processedCanvas
    const ctx = canvas.getContext("2d")
    if (!ctx) return null

    // 座標をオリジナルサイズに変換
    const originalX = Math.floor(x / zoomLevel)
    const originalY = Math.floor(y / zoomLevel)

    if (originalX < 0 || originalX >= canvas.width || originalY < 0 || originalY >= canvas.height) {
      return null
    }

    const imageData = ctx.getImageData(originalX, originalY, 1, 1)
    const [r, g, b, a] = imageData.data

    const toHex = `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`

    return { color: toHex, a, originalX, originalY }
  }

  /** ズームレベル変更時の処理 */
  function handleZoomChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newZoomLevel = parseFloat(e.target.value)

    if (processedCanvas && containerRef.current) {
      const container = containerRef.current
      const containerWidth = container.clientWidth
      const containerHeight = container.clientHeight

      const oldZoomLevel = zoomLevel

      // ズーム前の中心点のキャンバス上の座標
      const centerX = (containerWidth / 2 - canvasPosition.x) / oldZoomLevel
      const centerY = (containerHeight / 2 - canvasPosition.y) / oldZoomLevel

      // ズーム後の新しいキャンバス位置
      let newX = containerWidth / 2 - centerX * newZoomLevel
      let newY = containerHeight / 2 - centerY * newZoomLevel

      const newCanvasWidth = processedCanvas.width * newZoomLevel
      const newCanvasHeight = processedCanvas.height * newZoomLevel

      // X軸の移動制限
      if (newCanvasWidth > containerWidth) {
        const minX = containerWidth - newCanvasWidth
        newX = Math.max(minX, Math.min(newX, 0))
      } else {
        newX = (containerWidth - newCanvasWidth) / 2
      }

      // Y軸の移動制限
      if (newCanvasHeight > containerHeight) {
        const minY = containerHeight - newCanvasHeight
        newY = Math.max(minY, Math.min(newY, 0))
      } else {
        newY = (containerHeight - newCanvasHeight) / 2
      }

      setZoomLevel(newZoomLevel)
      setCanvasPosition({ x: newX, y: newY })
      setInitialPosition({ x: newX, y: newY })
    } else {
      setZoomLevel(newZoomLevel)
    }
  }

  function handleMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    if (canvasRef.current) {
      if (isDragging && containerRef.current) {
        e.preventDefault()

        const container = containerRef.current
        const canvasWidth = canvasRef.current.width
        const canvasHeight = canvasRef.current.height
        const containerWidth = container.clientWidth
        const containerHeight = container.clientHeight

        let newX = initialPosition.x + (e.clientX - dragStart.x)
        let newY = initialPosition.y + (e.clientY - dragStart.y)

        if (canvasWidth > containerWidth) {
          const minX = containerWidth - canvasWidth
          newX = Math.max(minX, Math.min(newX, 0))
        } else {
          newX = (containerWidth - canvasWidth) / 2
        }

        if (canvasHeight > containerHeight) {
          const minY = containerHeight - canvasHeight
          newY = Math.max(minY, Math.min(newY, 0))
        } else {
          newY = (containerHeight - canvasHeight) / 2
        }
        setCanvasPosition({ x: newX, y: newY })
      }

      const rect = canvasRef.current.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top

      const pixelInfo = getPixelColor(x, y)
      if (pixelInfo) {
        const colorName = COLOR_NAME_MAP[pixelInfo.color.toLowerCase()] || "Unknown Color"
        const colorText = pixelInfo.a < 255 ? "透明" : `${colorName}\n${pixelInfo.color}`

        setColorInfo({
          show: !isDragging,
          text: `(${Math.floor(pixelInfo.originalX / (currentBlockSize || 1))}, ${Math.floor(pixelInfo.originalY / (currentBlockSize || 1))})\n${colorText}`,
        })
      } else {
        setColorInfo({ show: false, text: "" })
      }
    }
  }

  function handleMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    e.preventDefault()
    setIsDragging(true)
    setDragStart({
      x: e.clientX,
      y: e.clientY,
    })
  }

  function handleMouseUp() {
    if (isDragging) {
      setIsDragging(false)
      setInitialPosition(canvasPosition)

      //showの値のみを変更して他は元々の値を使う（ピクセル情報はzoom-controls内に表示）
      setColorInfo((prev) => ({ ...prev, show: true }))
    }
  }

  function handleMouseLeave() {
    if (isDragging) {
      setIsDragging(false)
      setInitialPosition(canvasPosition)
    }
    setColorInfo({ show: false, text: "" })
  }

  function downloadImage() {
    if (processedCanvas) {
      const link = document.createElement("a")
      link.download = "pixelated_image.png"
      link.href = processedCanvas.toDataURL("image/png")
      link.click()
    }
  }

  function handleSaveToLibrary() {
    if (processedCanvas) {
      const imageData = processedCanvas.toDataURL("image/png")
      try {
        const libraryData: LibraryImage[] = JSON.parse(localStorage.getItem("imageLibrary") || "[]")
        libraryData.push({
          imageData,
          createdAt: new Date().toISOString(),
          width: processedCanvas.width,
          height: processedCanvas.height,
          blockSize: currentBlockSize,
        })
        localStorage.setItem("imageLibrary", JSON.stringify(libraryData))
        alert("ライブラリに保存しました")
      } catch (error) {
        console.error("Error saving image to library:", error)
        alert("ライブラリの保存に失敗しました")
      }
    }
  }

  useEffect(() => {
    drawCanvas()
  }, [drawCanvas])

  // biome-ignore lint/correctness/useExhaustiveDependencies: sidebar changes should trigger recenter
  useEffect(() => {
    // HACK: sidebar animation is 300ms
    const id = setTimeout(() => {
      if (processedCanvas && containerRef.current) {
        const container = containerRef.current
        const canvasWidth = processedCanvas.width * zoomLevel
        const canvasHeight = processedCanvas.height * zoomLevel
        const containerWidth = container.clientWidth
        const containerHeight = container.clientHeight

        let newX = canvasPosition.x
        let newY = canvasPosition.y

        // X軸の移動制限と中央揃え
        if (canvasWidth > containerWidth) {
          const minX = containerWidth - canvasWidth
          newX = Math.max(minX, Math.min(newX, 0))
        } else {
          newX = (containerWidth - canvasWidth) / 2
        }

        // Y軸の移動制限と中央揃え
        if (canvasHeight > containerHeight) {
          const minY = containerHeight - canvasHeight
          newY = Math.max(minY, Math.min(newY, 0))
        } else {
          newY = (containerHeight - canvasHeight) / 2
        }

        setCanvasPosition({ x: newX, y: newY })
        setInitialPosition({ x: newX, y: newY })
      } else {
        setCanvasPosition({ x: 0, y: 0 })
        setInitialPosition({ x: 0, y: 0 })
      }
    }, 300)

    return () => clearTimeout(id)
  }, [isSidebarOpen])

  // 移動位置とズームの初期化と中央揃え
  useEffect(() => {
    setZoomLevel(1)
    if (processedCanvas && containerRef.current) {
      const container = containerRef.current
      const canvasWidth = processedCanvas.width // zoom is 1
      const canvasHeight = processedCanvas.height // zoom is 1
      const containerWidth = container.clientWidth
      const containerHeight = container.clientHeight

      const x = (containerWidth - canvasWidth) / 2
      const y = (containerHeight - canvasHeight) / 2

      setCanvasPosition({ x, y })
      setInitialPosition({ x, y })
    } else {
      setCanvasPosition({ x: 0, y: 0 })
      setInitialPosition({ x: 0, y: 0 })
    }
  }, [processedCanvas])

  return (
    <div className="preview-container">
      <div className="pixel-info">
        <p>{!isDragging && colorInfo.show && <>{colorInfo.text}</>}</p>
        <p>
          ({processedCanvas.width / (currentBlockSize || 1)}x{processedCanvas.height / (currentBlockSize || 1)})
        </p>
      </div>
      <div className="zoom-controls">
        <label htmlFor="zoomSelect">ズーム:</label>
        <select id="zoomSelect" value={zoomLevel} onChange={handleZoomChange}>
          <option value="0.5">50%</option>
          <option value="1">100%</option>
          <option value="2">200%</option>
          <option value="4">400%</option>
          <option value="8">800%</option>
          <option value="12">1200%</option>
        </select>
        <button className="download-btn" onClick={downloadImage} type="button">
          PNG ダウンロード
        </button>
        <button className="save-btn" onClick={handleSaveToLibrary} type="button">
          ライブラリに保存
        </button>
      </div>
      <div className="canvas-container" ref={containerRef}>
        <canvas
          ref={canvasRef}
          style={{
            cursor: isDragging ? "grabbing" : "crosshair",
            transform: `translate(${canvasPosition.x}px, ${canvasPosition.y}px)`,
            touchAction: "none",
          }}
          onMouseMove={handleMouseMove}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
        ></canvas>
      </div>
    </div>
  )
}

function initialColorSelectionState() {
  const state: { [key: string]: boolean } = {}
  SELECTABLE_COLORS.forEach((color) => {
    state[color.name] = true
  })
  return state
}

export default function ImageConversion() {
  const [blockSize, setBlockSize] = useState(4)
  const [ditherChecked, setDitherChecked] = useState(false)
  const [noPixelateChecked, setNoPixelateChecked] = useState(false)
  const [currentImage, setCurrentImage] = useState<HTMLImageElement | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [processedCanvas, setProcessedCanvas] = useState<HTMLCanvasElement | null>(null)
  const [selectedColors, setSelectedColors] = useState(initialColorSelectionState)
  const [mounted, setMounted] = useState(false)
  const [isColorPaletteOpen, setIsColorPaletteOpen] = useState(false)
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)

  const currentBlockSize = useRef(0)

  useEffect(() => {
    setMounted(true)

    const imageData = sessionStorage.getItem("selectedImage")
    if (imageData) {
      const img = new window.Image()
      img.onload = () => {
        const canvas = document.createElement("canvas")
        const width = sessionStorage.getItem("selectedImageWidth")
        const height = sessionStorage.getItem("selectedImageHeight")
        const blockSize = sessionStorage.getItem("selectedImageBlockSize")
        console.log("blockSize from sessionStorage:", blockSize)
        currentBlockSize.current = blockSize ? parseInt(blockSize, 10) : 1
        canvas.width = width ? parseInt(width, 10) : img.width
        canvas.height = height ? parseInt(height, 10) : img.height
        const ctx = canvas.getContext("2d")
        ctx?.drawImage(img, 0, 0)
        setProcessedCanvas(canvas)
      }
      img.src = imageData
    }
  }, [])

  /** 画像ファイル選択時の処理 */
  function handleFileSelect(file: File) {
    if (!file.type.startsWith("image/")) {
      alert("画像ファイルを選択してください")
      return
    }

    if (file.size > 4 * 1024 * 1024) {
      setError("ファイルサイズは4MB以下にしてください")
      setCurrentImage(null)
      setSelectedFile(null)
      return
    }
    setError(null)

    setSelectedFile(file)

    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new window.Image()
      img.onload = () => {
        setCurrentImage(img)
      }
      img.src = e.target?.result as string
    }
    reader.readAsDataURL(file)
  }

  /** 画像処理のメイン関数 */
  async function processImage() {
    if (!selectedFile) return

    setProcessing(true)
    setProcessedCanvas(null)

    // 最終的なパレットを作成
    const finalPalette = [...DEFAULT_COLORS]
    SELECTABLE_COLORS.forEach((color) => {
      if (selectedColors[color.name]) {
        finalPalette.push(color)
      }
    })

    // HEX to RGB
    const finalPaletteRGB = finalPalette.map((c) => {
      const r = parseInt(c.hex.slice(1, 3), 16)
      const g = parseInt(c.hex.slice(3, 5), 16)
      const b = parseInt(c.hex.slice(5, 7), 16)
      return [r, g, b]
    })

    currentBlockSize.current = ditherChecked || noPixelateChecked ? 1 : blockSize

    const formData = new FormData()
    formData.append("image", selectedFile)
    formData.append("palette", JSON.stringify(finalPaletteRGB))
    formData.append("blockSize", currentBlockSize.current.toString())
    formData.append("isDither", ditherChecked.toString())
    formData.append("isNoPixelate", noPixelateChecked.toString())

    try {
      const dataUrl = await imageConversion(formData)

      const img = new window.Image()
      img.onload = () => {
        const canvas = document.createElement("canvas")
        canvas.width = img.width
        canvas.height = img.height
        const ctx = canvas.getContext("2d")
        ctx?.drawImage(img, 0, 0)

        setProcessedCanvas(canvas)
      }
      img.src = dataUrl
    } catch (error) {
      setProcessedCanvas(null)
      setCurrentImage(null)
      setSelectedFile(null)
      console.error("Image processing error:", error)
      alert("画像の処理中にエラーが発生しました。")
    }

    // UI更新のために少し待つ
    setTimeout(() => {
      setProcessing(false)
    }, 100)
  }

  if (!mounted) return null

  return (
    <div className={`app-container ${isSidebarOpen ? "" : "sidebar-closed"}`}>
      <div className="main-content">
        {processing ? (
          <div className="processing">
            <div className="loader">
              <div className="loader-dot"></div>
              <div className="loader-dot"></div>
              <div className="loader-dot"></div>
            </div>
            <p>処理中...</p>
          </div>
        ) : processedCanvas ? (
          <ImagePreview
            processedCanvas={processedCanvas}
            currentBlockSize={currentBlockSize.current}
            isSidebarOpen={isSidebarOpen}
          />
        ) : (
          <h1>Wplace Image Conversion</h1>
        )}
      </div>
      <div className="sidebar">
        <div className="settings-panel">
          <div className="setting">
            <label htmlFor="imageInput" className="upload-area">
              {currentImage ? (
                // biome-ignore lint/performance/noImgElement: false positive, using <img> for preview is intentional
                <img src={currentImage.src} alt="Upload preview" className="upload-preview-image" />
              ) : (
                <div className="upload-icon">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    width="48"
                    height="48"
                    shapeRendering="crispEdges"
                  >
                    <title>Upload image icon</title>
                    <path d="M4 3h16v1H4zm-1 1h18v1H3zm-1 1h2v15H2zm18 0h2v15h-2zM3 20h18v1H3zm1 1h16v1H4zM8 7h2v1H8zM7 8h4v1H7zM6 9h2v2H6zm4 0h2v2h-2zM7 11h4v1H7zm1 1h2v1H8zm7-2h2v1h-2zm-1 1h4v1h-4zm-1 1h6v1h-6zm-1 1h3v1h-3zm5 0h3v1h-3zm-6 1h3v1h-3zm7 0h2v1h-2zm-8 1h3v1h-3zm9 0h1v1h-1zm-10 1h3v1H9zm-1 1h3v1H8zm-1 1h3v1H7zm-1 1h3v1H6z" />
                  </svg>
                </div>
              )}
              <p>クリックして画像を選択</p>
              <input
                type="file"
                id="imageInput"
                accept="image/*"
                style={{ display: "none" }}
                onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
              />
            </label>
            {error && <p className="error-message">{error}</p>}

            <div className="controls">
              <div className="control-group">
                <label htmlFor="blockSize">ブロックサイズ: {blockSize}</label>
                <input
                  type="range"
                  min="2"
                  max="12"
                  value={blockSize}
                  onChange={(e) => setBlockSize(parseInt(e.target.value, 10))}
                />
              </div>
              <div className="control-group">
                <div className="checkbox-group">
                  <input
                    type="checkbox"
                    id="ditherCheck"
                    checked={ditherChecked}
                    onChange={(e) => setDitherChecked(e.target.checked)}
                  />
                  <label htmlFor="ditherCheck">ディザリング</label>
                </div>
                <div className="checkbox-group">
                  <input
                    type="checkbox"
                    id="noPixelateCheck"
                    checked={noPixelateChecked}
                    onChange={(e) => setNoPixelateChecked(e.target.checked)}
                  />
                  <label htmlFor="noPixelateCheck">ピクセル化なし</label>
                </div>
              </div>
            </div>
          </div>

          <div className="control-group">
            <button type="button" className="palette-toggle" onClick={() => setIsColorPaletteOpen(true)}>
              追加カラーパレット
            </button>
          </div>
        </div>

        <button className="process-btn" disabled={!selectedFile || processing} onClick={processImage} type="button">
          画像を処理
        </button>

        <ThemeToggle />
        <Link href="/" className="home-link">
          ホームに戻る
        </Link>
      </div>

      <button className="toggle-sidebar-btn" onClick={() => setIsSidebarOpen(!isSidebarOpen)} type="button">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <title>{isSidebarOpen ? "サイドバーを閉じる" : "サイドバーを開く"}</title>
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </button>
      {isColorPaletteOpen && (
        <SelectColorsModal
          selectedColors={selectedColors}
          setSelectedColors={setSelectedColors}
          onClose={() => setIsColorPaletteOpen(false)}
        />
      )}
    </div>
  )
}
