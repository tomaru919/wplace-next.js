"use client"

interface SidebarActionsProps {
  zoomLevel: number
  handleZoomChange: (e: React.ChangeEvent<HTMLSelectElement>) => void
  processedCanvas: HTMLCanvasElement | null
}

export function SidebarActions({ zoomLevel, handleZoomChange, processedCanvas }: SidebarActionsProps) {
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
        const libraryData = JSON.parse(localStorage.getItem("imageLibrary") || "[]")
        libraryData.push({ imageData, createdAt: new Date().toISOString() })
        localStorage.setItem("imageLibrary", JSON.stringify(libraryData))
        alert("ライブラリに保存しました")
      } catch (error) {
        console.error("Error saving image to library:", error)
        alert("ライブラリの保存に失敗しました")
      }
    }
  }

  return (
    <div className="sidebar-actions">
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
      </div>
      <button className="download-btn" onClick={downloadImage} type="button">
        PNG ダウンロード
      </button>
      <button className="save-btn" onClick={handleSaveToLibrary} type="button">
        ライブラリに保存
      </button>
    </div>
  )
}
