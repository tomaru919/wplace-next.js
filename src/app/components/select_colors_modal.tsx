// src\app\components\select_colors_modal.tsx
import { SELECTABLE_COLORS } from "@/lib/palette"

export function SelectColorsModal({
  selectedColors,
  setSelectedColors,
  onClose,
}: Readonly<{
  selectedColors: { [key: string]: boolean }
  setSelectedColors: React.Dispatch<React.SetStateAction<{ [key: string]: boolean }>>
  onClose: () => void
}>) {
  /** カラー選択のハンドラ */
  function handleColorSelectionChange(colorName: string) {
    setSelectedColors((prev) => ({
      ...prev,
      [colorName]: !prev[colorName],
    }))
  }

  function selectAllColor() {
    setSelectedColors((prev) => {
      const state: { [key: string]: boolean } = {}
      for (const color of Object.keys(prev)) {
        state[color] = true
      }
      return state
    })
  }

  function deselectAllColors() {
    setSelectedColors((prev) => {
      const state: { [key: string]: boolean } = {}
      for (const color of Object.keys(prev)) {
        state[color] = false
      }
      return state
    })
  }

  return (
    <div className="modal-overlay">
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="color-settings-container">
          <div className="control-group color-selection">
            <div className="color-selection-header">
              <div className="color-selection-controls">
                <button onClick={selectAllColor} type="button">
                  すべて選択
                </button>
                <button onClick={deselectAllColors} type="button">
                  すべて解除
                </button>
              </div>
            </div>
            <div className="color-checkboxes">
              {SELECTABLE_COLORS.map((color) => (
                <div className="checkbox-group" key={color.name}>
                  <input
                    type="checkbox"
                    id={`color-${color.name}`}
                    checked={selectedColors[color.name]}
                    onChange={() => handleColorSelectionChange(color.name)}
                  />
                  <span className="color-swatch" style={{ backgroundColor: color.hex }}></span>
                  <label htmlFor={`color-${color.name}`}>{color.name}</label>
                </div>
              ))}
            </div>
          </div>
        </div>
        <button type="button" className="palette-toggle" onClick={onClose}>
          閉じる
        </button>
      </div>
    </div>
  )
}
