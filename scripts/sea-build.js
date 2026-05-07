// Build Windows executable using Node.js SEA (Single Executable Application)
import { cpSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { execSync } from "node:child_process";
import { join } from "node:path";

const DIST = "dist";
const EXE = join(DIST, "韵易-win.exe");
const SENTINEL = "NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2";

console.log("1/4 Creating SEA config...");
const config = { main: join(DIST, "server.cjs"), output: join(DIST, "sea-prep.blob") };
writeFileSync(join(DIST, "sea-config.json"), JSON.stringify(config));

console.log("2/4 Generating SEA blob...");
execSync(`node --experimental-sea-config ${join(DIST, "sea-config.json")}`, {
  stdio: "inherit",
});

console.log("3/4 Copying node.exe...");
cpSync(process.execPath, EXE);

if (existsSync(EXE + ".old")) rmSync(EXE + ".old");

console.log("4/4 Injecting SEA blob...");
execSync(
  `npx postject ${EXE} NODE_SEA_BLOB ${join(DIST, "sea-prep.blob")} --sentinel-fuse ${SENTINEL}`,
  { stdio: "inherit" },
);

console.log(`\nDone! Created ${EXE}`);
console.log("Single portable executable — all data embedded. Just run it.");
