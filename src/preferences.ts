import type { MirrorOptions } from "./types";

const storageKey = "panda-mirror-settings-v1";

export const defaultOptions: MirrorOptions = {
  serial: "", maxSize: 1920, videoBitRateMbps: 12, maxFps: 60,
  turnScreenOff: false, stayAwake: true, fullscreen: false,
  audio: true, alwaysOnTop: false,
  launchPandaMousePro: true, virtualDisplay: false
};

export function loadOptions(): MirrorOptions {
  const options = { ...defaultOptions };
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(storageKey) ?? "null");
    if (!saved || typeof saved !== "object" || Array.isArray(saved)) return options;
    const values = saved as Record<string, unknown>;
    for (const key of ["turnScreenOff", "stayAwake", "fullscreen", "audio", "alwaysOnTop", "launchPandaMousePro", "virtualDisplay"] as const) {
      if (typeof values[key] === "boolean") options[key] = values[key];
    }
    for (const [key, allowed] of [
      ["maxSize", [1280, 1600, 1920, 2560]],
      ["maxFps", [30, 60, 90, 120]],
      ["videoBitRateMbps", [4, 8, 12, 20]]
    ] as const) {
      const value = values[key];
      if (typeof value === "number" && (allowed as readonly number[]).includes(value)) options[key] = value;
    }
    if (options.virtualDisplay) {
      options.turnScreenOff = false;
      options.launchPandaMousePro = true;
    }
  } catch {
    // Invalid or unavailable storage must not prevent startup.
  }
  return options;
}

export function saveOptions(options: MirrorOptions): void {
  // Device connections are transient; choose from the current adb device list.
  const { serial: _serial, ...settings } = options;
  try {
    localStorage.setItem(storageKey, JSON.stringify(settings));
  } catch {
    // Settings remain usable if the webview storage is unavailable.
  }
}
