/**
 * Génère les icônes de la PWA, le favicon et l'image du logo à partir du logo Glowy.
 * Source : public/brand/glowy-logo.svg (icône carrée arrondie, dégradé violet).
 * Usage : node scripts/generate-pwa-icons.mjs  → public/icons/*.png, public/brand/glowy-mark.png, src/app/icon.png, src/app/apple-icon.png
 */
import { mkdir, readFile } from "node:fs/promises";
import sharp from "sharp";

const SOURCE = await readFile("public/brand/glowy-logo.svg");
/** Couleur moyenne du dégradé du logo, pour les icônes plein cadre (maskable, iOS) */
const FILL = "#8f45b5";

/** Logo aux coins arrondis d'origine */
const rounded = (size) => sharp(SOURCE, { density: 300 }).resize(size, size).png().toBuffer();

/** Logo réduit (zone sûre) centré sur un fond plein : Android / iOS appliquent leur propre forme */
async function onSolid(size, scale) {
  const inner = Math.round(size * scale);
  const logo = await rounded(inner);
  return sharp({ create: { width: size, height: size, channels: 4, background: FILL } })
    .composite([{ input: logo, gravity: "centre" }])
    .png()
    .toBuffer();
}

const outputs = [
  { file: "public/icons/icon-192.png", make: () => rounded(192) },
  { file: "public/icons/icon-512.png", make: () => rounded(512) },
  { file: "public/icons/maskable-512.png", make: () => onSolid(512, 0.8) },
  { file: "public/icons/apple-touch-icon.png", make: () => onSolid(180, 0.9) },
  { file: "public/icons/badge-96.png", make: () => rounded(96) },
  { file: "public/brand/glowy-mark.png", make: () => rounded(256) },
  { file: "src/app/icon.png", make: () => rounded(512) },
  { file: "src/app/apple-icon.png", make: () => onSolid(180, 0.9) },
];

await mkdir("public/icons", { recursive: true });
for (const { file, make } of outputs) {
  await sharp(await make()).toFile(file);
  console.log(file);
}
