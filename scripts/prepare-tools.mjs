import { createHash } from "node:crypto";
import { access, chmod, cp, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
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
// Windows ARM64 uses the same x64 tools through Windows 11 emulation.
const toolsArch = key === "win32-arm64" ? "x64" : process.arch;
const asset = assets[`${process.platform}-${toolsArch}`];

if (!asset) {
  throw new Error(`暂不支持 ${key}。目前支持 Windows x64/arm64、Linux x64、macOS x64/arm64。`);
}

if (key === "win32-arm64") {
  console.log("Windows ARM64：使用 Windows x64 adb/scrcpy 工具（通过系统模拟运行）。");
}

const required = process.platform === "win32" ? ["adb.exe", "scrcpy.exe", "scrcpy-server"] : ["adb", "scrcpy", "scrcpy-server"];
const existingMetadata = await readFile(join(toolsDir, "panda-tools.json"), "utf8")
  .then(JSON.parse)
  .catch(() => null);
const existingFiles = await Promise.all(required.map((file) => access(join(toolsDir, file)).then(() => true).catch(() => false)));
if (existingMetadata?.sha256 === asset.sha256 && existingMetadata?.platform === process.platform && existingMetadata?.arch === toolsArch && existingFiles.every(Boolean)) {
  console.log(`复用已校验的 scrcpy ${SCRCPY_VERSION} 工具目录：${toolsDir}`);
  process.exit(0);
}

const workDir = await mkdtemp(join(tmpdir(), "panda-tools-"));
const archivePath = join(workDir, asset.file);
const extractDir = join(workDir, "extract");

try {
  console.log(`下载 scrcpy ${SCRCPY_VERSION} (${key})…`);
  // curl honors HTTPS_PROXY/HTTP_PROXY on Node versions whose fetch does not.
  const downloaded = spawnSync(process.platform === "win32" ? "curl.exe" : "curl", [
    "--fail", "--location", "--show-error",
    "--retry", "3", "--retry-all-errors", "--retry-delay", "2",
    "--connect-timeout", "30", "--max-time", "600",
    "--output", archivePath, `${RELEASE_BASE}/${asset.file}`
  ], { stdio: "inherit" });
  if (downloaded.error) {
    throw new Error(`无法运行 curl 下载工具：${downloaded.error.message}`);
  }
  if (downloaded.status !== 0) {
    throw new Error(`下载失败（curl exit ${downloaded.status}），请检查网络及 HTTP_PROXY/HTTPS_PROXY 设置。虚拟机应使用代理所在 Mac 的 IP，而不是 127.0.0.1。`);
  }

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
    arch: toolsArch,
    source: `${RELEASE_BASE}/${asset.file}`,
    sha256: digest
  }, null, 2));
  console.log(`工具已准备到 ${toolsDir}`);
  console.log(`包含：${required.map((file) => basename(file)).join(", ")}`);
} finally {
  await rm(workDir, { recursive: true, force: true });
}
