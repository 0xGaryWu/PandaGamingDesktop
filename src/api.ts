import { invoke } from "@tauri-apps/api/core";
import type { Device, EnvironmentStatus, MirrorOptions, MirrorState } from "./types";

export const desktopApi = {
  environment: () => invoke<EnvironmentStatus>("check_environment"),
  devices: () => invoke<Device[]>("list_devices"),
  activateApps: (serial: string) => invoke<string>("activate_apps", { serial }),
  start: (options: MirrorOptions) => invoke<MirrorState>("start_mirror", { options }),
  stop: () => invoke<MirrorState>("stop_mirror"),
  state: () => invoke<MirrorState>("mirror_state")
};
