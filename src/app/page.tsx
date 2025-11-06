import Link from "next/link"
import Library from "@/app/components/library"

export default function LibraryPage() {
  return (
    <div className="app-container">
      <div className="main-content">
        <div className="library-container">
          <h1>Wplace Image Conversion</h1>
          <Link href="/edit">Convert the image</Link>
          <Library />
        </div>
      </div>
    </div>
  )
}
