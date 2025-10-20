"use client"

import Link from "next/link"
import { useEffect, useState } from "react"

interface LibraryImage {
  imageData: string
  createdAt: string
}

export default function LibraryPage() {
  const [images, setImages] = useState<LibraryImage[]>([])

  useEffect(() => {
    try {
      const libraryData = JSON.parse(localStorage.getItem("imageLibrary") || "[]")
      setImages(libraryData)
    } catch (error) {
      console.error("Error reading from localStorage:", error)
      setImages([])
    }
  }, [])

  return (
    <div className="library">
      <h1>Image Library</h1>
      <Link href="/">Back to Home</Link>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
          gap: "1rem",
          marginTop: "1rem",
        }}
      >
        {images.length > 0 ? (
          images.map((image: LibraryImage) => (
            <div key={image.createdAt} style={{ border: "1px solid #ccc", padding: "0.5rem" }}>
              {/* biome-ignore lint/performance/noImgElement: false positive */}
              <img
                src={image.imageData}
                alt={`create at ${image.createdAt}`}
                style={{ width: "100%", height: "auto" }}
              />
              <p style={{ marginTop: "0.5rem", fontSize: "0.8rem", color: "#666" }}>
                Saved on: {new Date(image.createdAt).toLocaleString()}
              </p>
            </div>
          ))
        ) : (
          <p>Your saved images will appear here.</p>
        )}
      </div>
    </div>
  )
}
