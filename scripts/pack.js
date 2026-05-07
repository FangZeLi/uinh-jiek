import { cpSync } from "node:fs";

// Copy required runtime files into dist/
cpSync("tupa.dict.yaml", "dist/tupa.dict.yaml");
cpSync("viewer/dist", "dist/viewer", { recursive: true });

console.log("Packed successfully: dist/ is ready for distribution.");
