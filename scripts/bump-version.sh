#!/usr/bin/env bash

set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 <version> (for example: 0.1.5)" >&2
  exit 1
fi

version="$1"
if [[ ! "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+([+-][0-9A-Za-z.-]+)?$ ]]; then
  echo "Invalid version: $version" >&2
  exit 1
fi

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "$script_dir/.." && pwd)"
cd "$repo_root"

branch="$(git branch --show-current)"
if [[ -z "$branch" ]]; then
  echo "Cannot release from a detached HEAD." >&2
  exit 1
fi

unexpected_changes="$(git status --porcelain | awk '$2 != "scripts/bump-version.sh" { print }')"
if [[ -n "$unexpected_changes" ]]; then
  echo "Commit or stash existing changes before bumping the version:" >&2
  echo "$unexpected_changes" >&2
  exit 1
fi

if git rev-parse "v$version" >/dev/null 2>&1; then
  echo "Tag v$version already exists." >&2
  exit 1
fi

VERSION="$version" node <<'NODE'
const fs = require("node:fs");

const version = process.env.VERSION;

function replaceChecked(path, pattern, replacement, expectedCount = 1) {
  const source = fs.readFileSync(path, "utf8");
  let count = 0;
  const updated = source.replace(pattern, (...args) => {
    count += 1;
    return typeof replacement === "function" ? replacement(...args) : replacement;
  });
  if (count !== expectedCount) {
    throw new Error(`${path}: expected ${expectedCount} version field(s), found ${count}`);
  }
  fs.writeFileSync(path, updated);
}

const withVersion = (_, prefix, suffix) => `${prefix}${version}${suffix}`;

replaceChecked("package.json", /("version"\s*:\s*")[^"]+("\s*,)/, withVersion);
replaceChecked("package-lock.json", /^(  "version"\s*:\s*")[^"]+("\s*,)/m, withVersion);
replaceChecked(
  "package-lock.json",
  /("packages"\s*:\s*\{\s*""\s*:\s*\{\s*"name"\s*:\s*"panda-gaming-desktop"\s*,\s*"version"\s*:\s*")[^"]+("\s*,)/,
  withVersion
);
replaceChecked("src-tauri/tauri.conf.json", /("version"\s*:\s*")[^"]+("\s*,)/, withVersion);
replaceChecked("src-tauri/Cargo.toml", /(\[package\][\s\S]*?\nversion\s*=\s*")[^"]+("\s*\n)/, withVersion);
replaceChecked("src-tauri/Cargo.lock", /(\[\[package\]\]\nname = "panda-gaming-desktop"\nversion = ")[^"]+("\n)/, withVersion);
NODE

version_files=(
  package.json
  package-lock.json
  src-tauri/Cargo.toml
  src-tauri/Cargo.lock
  src-tauri/tauri.conf.json
)

git add "${version_files[@]}" scripts/bump-version.sh
git commit -m "update version to $version"
git tag "v$version"
git push --atomic origin "$branch" "refs/tags/v$version"

echo "Released v$version from $branch."
