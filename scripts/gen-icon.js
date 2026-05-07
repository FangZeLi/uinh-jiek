// Generate electron/icon.png (512x512)
import sharp from "sharp";

const SIZE = 512;
const PURPLE = "#6366f1";
const RADIUS = 96;

const svg = `<svg width="${SIZE}" height="${SIZE}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${SIZE}" height="${SIZE}" rx="${RADIUS}" ry="${RADIUS}" fill="${PURPLE}"/>
  <text x="${SIZE / 2}" y="290" text-anchor="middle" font-family="sans-serif" font-size="200" font-weight="bold" fill="white">韵</text>
  <text x="${SIZE / 2}" y="390" text-anchor="middle" font-family="sans-serif" font-size="48" fill="rgba(255,255,255,0.7)">uinh</text>
</svg>`;

sharp(Buffer.from(svg)).png().toFile("electron/icon.png").then(() => console.log("Created electron/icon.png"));
