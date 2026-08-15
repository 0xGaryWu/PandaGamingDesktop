import { createHash } from "node:crypto";
import { createWriteStream } from "node:fs";
import { access, chmod, cp, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const SCRCPY_VERSION = "4.1";
const RELEASE_BASE = `https://github.com/Genymobile/scrcpy/releases/download/v${SCRCPY_VERSION}`;
const assets = {
  "darwin-arm64": {
    file: `scrcpy-macos-aarch64-v${SCRCPY_VERSION}.tar.gz`,
    sha256: "20fd47c9014dd5e0fa77091f3cb7adbda8445a360c4584aeaa0150b5b3988ff3"
  },
  "darwin-x64": {
    file: `scrcpy-macos-x86_64-v${SCRCPY_VERSION}.tar.gz`,
    sha256: "ee2a7223bc8dbdc4f482db1134bcf441178dafb833492b71ca4c22090c58ce72"
  },
  "linux-x64": {
    file: `scrcpy-linux-x86_64-v${SCRCPY_VERSION}.tar.gz`,
    sha256: "ad56ae8bfeedf41e824945c11dbf55fcb092b3e615b9b486f48a50e30d389635"
  },
  "win32-x64": {
    file: `scrcpy-win64-v${SCRCPY_VERSION}.zip`,
    sha256: "5b12172b3264b2889f4583ee64752ce832e29bc8b1089dca81093459697165db"
  }
};

const projectRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const toolsDir = join(projectRoot, "src-tauri", "tools");
const key = `${process.platform}-${process.arch}`;
const asset = assets[key];

if (!asset) {
  throw new Error(`暂不支持 ${key}。目前支持 Windows x64、Linux x64、macOS x64/arm64。`);
}

const required = process.platform === "win32" ? ["adb.exe", "scrcpy.exe", "scrcpy-server"] : ["adb", "scrcpy", "scrcpy-server"];
const existingMetadata = await readFile(join(toolsDir, "panda-tools.json"), "utf8")
  .then(JSON.parse)
  .catch(() => null);
const existingFiles = await Promise.all(required.map((file) => access(join(toolsDir, file)).then(() => true).catch(() => false)));
if (existingMetadata?.sha256 === asset.sha256 && existingMetadata?.platform === process.platform && existingMetadata?.arch === process.arch && existingFiles.every(Boolean)) {
  console.log(`复用已校验的 scrcpy ${SCRCPY_VERSION} 工具目录：${toolsDir}`);
  process.exit(0);
}

const workDir = await mkdtemp(join(tmpdir(), "panda-tools-"));
const archivePath = join(workDir, asset.file);
const extractDir = join(workDir, "extract");

try {
  console.log(`下载 scrcpy ${SCRCPY_VERSION} (${key})…`);
  const response = await fetch(`${RELEASE_BASE}/${asset.file}`, { redirect: "follow" });
  if (!response.ok || !response.body) throw new Error(`下载失败：HTTP ${response.status}`);
  await pipeline(Readable.fromWeb(response.body), createWriteStream(archivePath));

  const digest = createHash("sha256").update(await readFile(archivePath)).digest("hex");
  if (digest !== asset.sha256) {
    throw new Error(`SHA-256 校验失败：期望 ${asset.sha256}，实际 ${digest}`);
  }

  await mkdir(extractDir);
  const extracted = spawnSync("tar", ["-xf", archivePath, "-C", extractDir], { stdio: "inherit" });
  if (extracted.status !== 0) throw new Error("无法解压 scrcpy 官方归档");

  const entries = await readdir(extractDir, { withFileTypes: true });
  const root = entries.find((entry) => entry.isDirectory());
  if (!root) throw new Error("scrcpy 归档结构无效");

  await rm(toolsDir, { recursive: true, force: true });
  await mkdir(toolsDir, { recursive: true });
  await cp(join(extractDir, root.name), toolsDir, { recursive: true });
  await writeFile(join(toolsDir, ".gitkeep"), "");

  if (process.platform !== "win32") {
    await chmod(join(toolsDir, "adb"), 0o755);
    await chmod(join(toolsDir, "scrcpy"), 0o755);
  }

  for (const file of required) {
    const found = await readFile(join(toolsDir, file)).catch(() => null);
    if (!found) throw new Error(`官方归档缺少必要文件：${file}`);
  }

  await writeFile(join(toolsDir, "panda-tools.json"), JSON.stringify({
    scrcpyVersion: SCRCPY_VERSION,
    platform: process.platform,
    arch: process.arch,
    source: `${RELEASE_BASE}/${asset.file}`,
    sha256: digest
  }, null, 2));
  console.log(`工具已准备到 ${toolsDir}`);
  console.log(`包含：${required.map((file) => basename(file)).join(", ")}`);
} finally {
  await rm(workDir, { recursive: true, force: true });
}
