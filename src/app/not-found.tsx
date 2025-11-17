// src\app\not-found.tsx
import Link from "next/link"

export default function NotFound() {
  return (
    <div className="app-container">
      <div className="main-content" style={{ flexDirection: "column" }}>
        <h1
          style={{
            color: "var(--primary-accent)",
            textShadow: "4px 4px 0px var(--shadow-main)",
          }}
        >
          404 - Page Not Found
        </h1>
        <p>The page you are looking for does not exist.</p>
        <Link href="/" className="home-link">
          Go back to Home
        </Link>
      </div>
    </div>
  )
}
