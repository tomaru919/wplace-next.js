/* tslint:disable */
/* eslint-disable */

/**
 * RGBA ピクセル配列をその場で変換する。
 *
 * - `data`: RGBA ピクセル配列（`width * height * 4` バイト）。結果はこの配列に書き戻される
 * - `palette`: パレット色を `[r, g, b, r, g, b, ...]` と並べた配列
 * - `block_size`: ピクセル化するときの 1 ブロックの大きさ
 * - `is_dither`: Floyd–Steinberg ディザリングを使うか
 * - `is_no_pixelate`: ピクセル化を行わないか
 */
export function convert(data: Uint8Array, width: number, height: number, palette: Uint8Array | number[], block_size: number, is_dither: boolean, is_no_pixelate: boolean): void;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly convert: (a: number, b: number, c: any, d: number, e: number, f: number, g: number, h: number, i: number, j: number) => [number, number];
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __externref_table_dealloc: (a: number) => void;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
