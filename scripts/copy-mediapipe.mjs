/**
 * Copie le moteur WebAssembly de MediaPipe (segmentation des cheveux de l'essai virtuel de couleur) dans public/mediapipe,
 * servi par le site lui-même : aucun CDN tiers, et la photo reste dans le navigateur. Lancé après `npm install` et avant `next build`.
 */
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const from = join(root, "node_modules/@mediapipe/tasks-vision/wasm");
const to = join(root, "public/mediapipe");
const FILES = ["vision_wasm_internal.js", "vision_wasm_internal.wasm", "vision_wasm_nosimd_internal.js", "vision_wasm_nosimd_internal.wasm"];

if (!existsSync(from)) {
  console.warn("copy-mediapipe : @mediapipe/tasks-vision absent, essai virtuel de couleur indisponible");
} else {
  mkdirSync(to, { recursive: true });
  for (const file of FILES) copyFileSync(join(from, file), join(to, file));
}
