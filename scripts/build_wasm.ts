/**
 * Rust のクレート（wasm/）を WebAssembly にビルドし、Next.js から使える場所（src/lib/wasm/）へ出力する。
 *
 *   bun run build:wasm
 *
 * 必要なツール:
 *   rustup target add wasm32-unknown-unknown
 *   cargo install wasm-bindgen-cli --version <wasm/Cargo.lock の wasm-bindgen と同じバージョン>
 */
import { join } from "node:path"
import { $ } from "bun"

const root = join(import.meta.dir, "..")
const crateDir = join(root, "wasm")
const outDir = join(root, "src", "lib", "wasm")

// 1. Rust → .wasm にコンパイル
await $`cargo build --release --target wasm32-unknown-unknown`.cwd(crateDir)

// 2. wasm-bindgen で JS から呼び出すためのグルーコード（.js）と型定義（.d.ts）を生成
//    --target web: ブラウザで ES Modules として読み込める形式。
//    生成された .js は `new URL("image_conversion_bg.wasm", import.meta.url)` で .wasm を参照し、
//    Turbopack がこれを検出して .wasm を静的ファイルとして配信してくれる
const wasmPath = join(crateDir, "target", "wasm32-unknown-unknown", "release", "image_conversion.wasm")
await $`wasm-bindgen ${wasmPath} --target web --out-dir ${outDir}`

console.log("WebAssembly のビルドが完了しました")
