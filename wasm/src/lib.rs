//! 画像のピクセル化・減色・ディザリングを行う WebAssembly モジュール。
//!
//! 画像のデコードやリサイズはブラウザ（canvas）に任せ、
//! ここでは RGBA のピクセル配列（`[r, g, b, a, r, g, b, a, ...]`）だけを扱う。

use wasm_bindgen::prelude::*;

/// RGBA ピクセル配列をその場で変換する。
///
/// - `data`: RGBA ピクセル配列（`width * height * 4` バイト）。結果はこの配列に書き戻される
/// - `palette`: パレット色を `[r, g, b, r, g, b, ...]` と並べた配列
/// - `block_size`: ピクセル化するときの 1 ブロックの大きさ
/// - `is_dither`: Floyd–Steinberg ディザリングを使うか
/// - `is_no_pixelate`: ピクセル化を行わないか
#[wasm_bindgen]
pub fn convert(
    data: &mut [u8],
    width: usize,
    height: usize,
    palette: &[u8],
    block_size: usize,
    is_dither: bool,
    is_no_pixelate: bool,
) -> Result<(), JsError> {
    if data.len() != width * height * 4 {
        return Err(JsError::new("data の長さが width * height * 4 と一致しません"));
    }
    if palette.is_empty() || palette.len() % 3 != 0 {
        return Err(JsError::new("palette は空でない [r, g, b, ...] の配列にしてください"));
    }

    // `chunks_exact(3)` で 3 要素ずつに区切り、`[u8; 3]` の配列（Vec）にする
    let palette: Vec<[u8; 3]> = palette.chunks_exact(3).map(|c| [c[0], c[1], c[2]]).collect();

    if !is_no_pixelate && block_size > 1 {
        pixelate(data, width, height, block_size);
    }
    make_fully_transparent(data);

    if is_dither {
        floyd_steinberg_dither(data, width, height, &palette);
    } else {
        quantize_to_nearest_color(data, &palette);
    }
    Ok(())
}

/// ブロックごとに中央のピクセル色で塗りつぶしてドット絵風にする
fn pixelate(data: &mut [u8], width: usize, height: usize, block_size: usize) {
    let half = block_size / 2;

    // `step_by` で block_size ごとに進む
    for by in (0..height).step_by(block_size) {
        for bx in (0..width).step_by(block_size) {
            // 画像の端でブロックがはみ出す場合も、画像内に収まる位置から色を取る
            let sample_x = (bx + half).min(width - 1);
            let sample_y = (by + half).min(height - 1);
            let sample_idx = (sample_y * width + sample_x) * 4;
            // スライスを配列にコピーしておく（この後 data を書き換えるため）
            let color: [u8; 4] = data[sample_idx..sample_idx + 4].try_into().unwrap();

            for y in by..(by + block_size).min(height) {
                for x in bx..(bx + block_size).min(width) {
                    let idx = (y * width + x) * 4;
                    data[idx..idx + 4].copy_from_slice(&color);
                }
            }
        }
    }
}

/// 半透明のピクセルを完全に透明にする
fn make_fully_transparent(data: &mut [u8]) {
    // `chunks_exact_mut(4)` で 1 ピクセル（RGBA の 4 バイト）ずつ書き換え可能な形で取り出す
    for pixel in data.chunks_exact_mut(4) {
        if pixel[3] < 255 {
            pixel[3] = 0;
        }
    }
}

/// パレットの中から最も近い色を探す（RGB のユークリッド距離の 2 乗で比較）
fn find_nearest_palette_color(r: u8, g: u8, b: u8, palette: &[[u8; 3]]) -> [u8; 3] {
    let distance = |color: &[u8; 3]| {
        let dr = r as i32 - color[0] as i32;
        let dg = g as i32 - color[1] as i32;
        let db = b as i32 - color[2] as i32;
        dr * dr + dg * dg + db * db
    };

    // `min_by_key` は最小値が複数あるとき最初の要素を返すので、JS 版（`<` で比較）と同じ結果になる
    *palette.iter().min_by_key(|color| distance(color)).unwrap()
}

/// 各ピクセルをパレット内の最も近い色に置き換える
fn quantize_to_nearest_color(data: &mut [u8], palette: &[[u8; 3]]) {
    for pixel in data.chunks_exact_mut(4) {
        if pixel[3] == 0 {
            continue; // 透明なピクセルはそのまま
        }
        let [r, g, b] = find_nearest_palette_color(pixel[0], pixel[1], pixel[2], palette);
        pixel[0] = r;
        pixel[1] = g;
        pixel[2] = b;
    }
}

/// Floyd–Steinberg ディザリング: 減色で生じた誤差を周囲の未処理ピクセルに分配する
///
/// ```text
///          [現在]  7/16
///   3/16    5/16   1/16
/// ```
fn floyd_steinberg_dither(data: &mut [u8], width: usize, height: usize, palette: &[[u8; 3]]) {
    for y in 0..height {
        for x in 0..width {
            let idx = (y * width + x) * 4;
            if data[idx + 3] == 0 {
                continue;
            }

            let old = [data[idx], data[idx + 1], data[idx + 2]];
            let new = find_nearest_palette_color(old[0], old[1], old[2], palette);
            data[idx..idx + 3].copy_from_slice(&new);

            let err = [
                old[0] as f64 - new[0] as f64,
                old[1] as f64 - new[1] as f64,
                old[2] as f64 - new[2] as f64,
            ];

            // (dx, dy, 重み) の組。x - 1 は usize で負にならないよう checked_sub を使う
            let neighbors: [(Option<usize>, usize, f64); 4] = [
                (Some(x + 1), y, 7.0),
                (x.checked_sub(1), y + 1, 3.0),
                (Some(x), y + 1, 5.0),
                (Some(x + 1), y + 1, 1.0),
            ];
            for (nx, ny, weight) in neighbors {
                let Some(nx) = nx else { continue };
                if nx >= width || ny >= height {
                    continue;
                }
                let n_idx = (ny * width + nx) * 4;
                for c in 0..3 {
                    data[n_idx + c] = to_clamped_u8(data[n_idx + c] as f64 + err[c] * weight / 16.0);
                }
            }
        }
    }
}

/// JavaScript の Uint8ClampedArray に代入したときと同じ変換（0〜255 に収め、偶数丸め）
fn to_clamped_u8(value: f64) -> u8 {
    value.clamp(0.0, 255.0).round_ties_even() as u8
}

#[cfg(test)]
mod tests {
    use super::*;

    const BW: [[u8; 3]; 2] = [[0, 0, 0], [255, 255, 255]];

    #[test]
    fn quantize_picks_nearest_color() {
        let mut data = vec![10, 10, 10, 255, 200, 200, 200, 255];
        quantize_to_nearest_color(&mut data, &BW);
        assert_eq!(data, vec![0, 0, 0, 255, 255, 255, 255, 255]);
    }

    #[test]
    fn semi_transparent_becomes_transparent_and_is_skipped() {
        let mut data = vec![10, 10, 10, 128];
        make_fully_transparent(&mut data);
        quantize_to_nearest_color(&mut data, &BW);
        assert_eq!(data, vec![10, 10, 10, 0]);
    }

    #[test]
    fn pixelate_fills_block_with_center_color() {
        // 2x2 ブロック 1 つ。中央 (1, 1) の色で塗られる
        let mut data = vec![
            1, 1, 1, 255, 2, 2, 2, 255, //
            3, 3, 3, 255, 4, 4, 4, 255,
        ];
        pixelate(&mut data, 2, 2, 2);
        assert_eq!(data, [4, 4, 4, 255].repeat(4));
    }

    #[test]
    fn dither_mid_gray_alternates() {
        // 128 のグレー 2 ピクセルを白黒でディザすると、誤差が伝わって白と黒に分かれる
        let mut data = vec![128, 128, 128, 255, 128, 128, 128, 255];
        floyd_steinberg_dither(&mut data, 2, 1, &BW);
        assert_eq!(data, vec![255, 255, 255, 255, 0, 0, 0, 255]);
    }

    #[test]
    fn clamped_rounding_matches_js() {
        assert_eq!(to_clamped_u8(2.5), 2); // 偶数丸め
        assert_eq!(to_clamped_u8(3.5), 4);
        assert_eq!(to_clamped_u8(-3.0), 0);
        assert_eq!(to_clamped_u8(300.0), 255);
    }
}
