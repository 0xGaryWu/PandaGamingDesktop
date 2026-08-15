export type ToolInfo = { available: boolean; path: string | null; version: string | null };
export type EnvironmentStatus = { adb: ToolInfo; scrcpy: ToolInfo };
export type Device = { serial: string; state: string; model: string | null; product: string | null; transportId: string | null };
export type MirrorOptions = {
  serial: string;
  maxSize: number;
  videoBitRateMbps: number;
  maxFps: number;
  turnScreenOff: boolean;
  stayAwake: boolean;
  fullscreen: boolean;
  borderless: boolean;
  audio: boolean;
  alwaysOnTop: boolean;
  showTouches: boolean;
  powerOffOnClose: boolean;
  virtualDisplay: boolean;
};
export type MirrorState = { running: boolean; pid: number | null; serial: string | null };
