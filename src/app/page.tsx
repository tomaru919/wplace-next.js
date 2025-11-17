// src\app\page.tsx
import Link from "next/link"
import Library from "@/app/components/library"
import { ThemeToggle } from "@/app/components/theme_toggle"

export default function LibraryPage() {
  return (
    <div className="app-container">
      <div className="library-container">
        <h1>Wplace Image Conversion</h1>
        <Link href="/edit" className="home-link">
          Convert the image
        </Link>
        <ThemeToggle />
        <Library />
      </div>
    </div>
  )
}
