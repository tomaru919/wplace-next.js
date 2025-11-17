// src\app\edit\page.tsx
import { headers } from "next/headers"
import Link from "next/link"
import ImageConversion from "@/app/components/image_conversion"

export default async function EditPage() {
  const userAgent = (await headers()).get("user-agent") || ""
  const isMobile = /iPhone|iPad|iPod|Android/i.test(userAgent)

  if (isMobile) {
    return (
      <div className="app-container">
        <div className="main-content" style={{ display: "grid", placeContent: "center", height: "100%" }}>
          <div style={{ textAlign: "center" }}>
            <h2>パソコンでアクセスしてください</h2>
            <p>このページはモバイルではご利用いただけません。</p>
            <Link href="/" className="home-link" style={{ marginTop: "20px", display: "inline-block" }}>
              ホームに戻る
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return <ImageConversion />
}
