// Generate electron/icon.png (512x512)
import sharp from "sharp";

const S = 512;

const svg = `<svg width="${S}" height="${S}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${S}" height="${S}" rx="96" ry="96" fill="#6366f1"/>
  <text x="${S/2 + 10}" y="378" text-anchor="middle" font-family="sans-serif" font-size="340" font-weight="bold" fill="white">韵</text>
  <text x="${S/2}" y="475" text-anchor="middle" font-family="sans-serif" font-size="56" fill="rgba(255,255,255,0.7)">uinh</text>
</svg>`;

sharp(Buffer.from(svg)).png().toFile("electron/icon.png")
  .then(() => console.log("Created electron/icon.png"));
