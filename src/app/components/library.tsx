"use client"

import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

interface LibraryImage {
  imageData: string
  createdAt: string
}

export default function Library() {
  const [images, setImages] = useState<LibraryImage[]>([])
  const [mounted, setMounted] = useState(false)
  const router = useRouter()

  useEffect(() => {
    setMounted(true)

    try {
      const libraryData = JSON.parse(localStorage.getItem("imageLibrary") || "[]")
      setImages(libraryData)
    } catch (error) {
      console.error("Error reading from localStorage:", error)
      setImages([])
    }
  }, [])

  function handleImageSelect(imageData: string) {
    sessionStorage.setItem("selectedImage", imageData)
    router.push("/edit")
  }

  function handleDeleteImage(createdAt: string) {
    try {
      const libraryData = JSON.parse(localStorage.getItem("imageLibrary") || "[]")
      const updatedLibrary = libraryData.filter((image: LibraryImage) => image.createdAt !== createdAt)
      localStorage.setItem("imageLibrary", JSON.stringify(updatedLibrary))
      setImages(updatedLibrary)
    } catch (error) {
      console.error("Error deleting from localStorage:", error)
    }
  }

  if (!mounted) return null

  return (
    <div className="image-library-grid">
      {images.length > 0 ? (
        images.map((image: LibraryImage) => (
          <div key={image.createdAt} className="image-card">
            {/* biome-ignore lint/performance/noImgElement: false positive */}
            <img src={image.imageData} alt={`create at ${image.createdAt}`} />
            <p>Saved on: {new Date(image.createdAt).toLocaleString()}</p>
            <div className="image-card-buttons">
              <button onClick={() => handleImageSelect(image.imageData)} className="use-image-btn" type="button">
                この画像を使う
              </button>
              <button onClick={() => handleDeleteImage(image.createdAt)} className="delete-btn" type="button">
                削除
              </button>
            </div>
          </div>
        ))
      ) : (
        <p>Your saved images will appear here.</p>
      )}
    </div>
  )
}
