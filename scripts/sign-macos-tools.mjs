import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

if (process.platform !== "darwin") process.exit(0);

const projectRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const config = JSON.parse(await readFile(resolve(projectRoot, "src-tauri", "tauri.conf.json"), "utf8"));
const identity = process.env.APPLE_SIGNING_IDENTITY || config.bundle?.macOS?.signingIdentity;

if (!identity || identity === "-") {
  throw new Error("A Developer ID Application signing identity is required to sign bundled macOS tools.");
}

const scrcpy = resolve(projectRoot, "src-tauri", "tools", "scrcpy");
const signed = spawnSync(
  "codesign",
  ["--force", "--options", "runtime", "--timestamp", "--sign", identity, scrcpy],
  { stdio: "inherit" }
);
if (signed.status !== 0) throw new Error("Failed to sign the bundled scrcpy executable.");

const verified = spawnSync("codesign", ["--verify", "--strict", "--verbose=2", scrcpy], {
  stdio: "inherit"
});
if (verified.status !== 0) throw new Error("The bundled scrcpy signature could not be verified.");

