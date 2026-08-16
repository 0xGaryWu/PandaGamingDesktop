export type Locale = "zh-CN" | "en";

const zh = {
  appTitle: "Panda Gaming Desktop",
  appDescriptionBefore: "借助开源项目",
  appDescriptionAfter: "，我们可以投射手机屏幕到电脑上，使用电脑的键鼠玩手机游戏！",
  standby: "待机",
  mirrorRunning: "镜像运行中",
  selectDevice: "选择设备",
  refresh: "刷新",
  waitingDevice: "等待 USB 或无线设备",
  enableUsbDebugging: "开启 USB 调试并允许此电脑进行调试",
  connected: "已连接",
  unauthorized: "未授权",
  unavailable: "未找到",
  available: "可用",
  mirrorSettings: "镜像设置",
  recommended: "推荐配置",
  maxResolution: "最高分辨率",
  maxFps: "最高帧率",
  videoBitrate: "视频码率",
  audioForwarding: "声音转发",
  stayAwake: "保持设备唤醒",
  startFullscreen: "启动即全屏",
  alwaysOnTop: "窗口置顶",
  launchPmp: "启动镜像时打开 Panda Mouse Pro",
  turnScreenOff: "启动后关闭手机屏幕",
  mappingMode: "键鼠映射模式",
  mappingDescription: "默认使用 -K -M 与 --mouse-bind=++++:++++，键盘和全部鼠标按键直接发送给手机。",
  enabledByDefault: "默认开启",
  virtualDisplayUnavailable: "独立投屏模式",
  virtualDisplayDescription: "将游戏独立投到电脑上游玩，手机主屏仍可正常操作；需要 Android 10 或更高版本。",
  experimental: "实验性",
  shortcuts: "快捷键速查",
  modDescription: "MOD = Command 或左 Alt",
  releaseMouse: "释放 / 捕获鼠标",
  toggleFullscreen: "进入 / 退出全屏",
  quitMirror: "退出镜像",
  togglePhoneScreen: "开关手机屏幕",
  goHome: "返回桌面",
  goBack: "返回上一级",
  recentTasks: "最近任务",
  rotateScreen: "旋转手机屏幕",
  adjustVolume: "调节音量",
  pasteClipboard: "粘贴剪贴板",
  keyboardSettings: "打开物理键盘设置",
  toggleFps: "显示 / 隐藏 FPS",
  shortcutNote: "在 macOS 上 Command 对应左侧 ⌘ 键；Windows 可使用左 Alt。鼠标映射模式下，左 Command、右 Command 或左 Alt 均可切换鼠标捕获。",
  startMirror: "启动镜像",
  startIndependentDisplay: "启动独立投屏",
  stopMirror: "停止镜像",
  activatePmp: "激活 Panda Mouse Pro",
  activatingPmp: "正在启动并激活 Panda Mouse Pro…",
  activationCommandCompleted: "Panda Mouse Pro 激活命令已执行",
  checkingEnvironment: "正在检查运行环境…",
  devicesFound: "已发现 {count} 台可用设备",
  noDevices: "未发现已授权的 Android 设备",
  mirrorStarted: "镜像已启动 · PID {pid}",
  mirrorStopped: "镜像已停止",
  mirrorWindowExited: "镜像窗口已退出",
  language: "语言",
  adbMissing: "未找到 adb，请重新安装 Panda Gaming Desktop",
  adbRunFailed: "无法运行 adb：{detail}",
  launchPmpFailed: "无法启动 Panda Mouse Pro：{detail}",
  activatePmpFailed: "Panda Mouse Pro 激活失败：{detail}",
  selectDeviceError: "请先选择设备",
  virtualDisplayError: "独立投屏需要 Android 10 或更高版本：{detail}",
  scrcpyMissing: "未找到 scrcpy，请重新安装 Panda Gaming Desktop",
  processUnavailable: "镜像进程状态不可用",
  mirrorAlreadyRunning: "镜像已经在运行",
  startFailed: "启动 scrcpy 失败：{detail}",
  stopFailed: "停止 scrcpy 失败：{detail}"
} as const;

const en: Record<keyof typeof zh, string> = {
  appTitle: "Panda Gaming Desktop",
  appDescriptionBefore: "Mirror Android to your computer with",
  appDescriptionAfter: " and play with a keyboard and mouse.",
  standby: "Standby",
  mirrorRunning: "Mirroring",
  selectDevice: "Select device",
  refresh: "Refresh",
  waitingDevice: "Waiting for a USB or wireless device",
  enableUsbDebugging: "Enable USB debugging and authorize this computer",
  connected: "Connected",
  unauthorized: "Unauthorized",
  unavailable: "Not found",
  available: "Available",
  mirrorSettings: "Mirror settings",
  recommended: "Recommended",
  maxResolution: "Max resolution",
  maxFps: "Max frame rate",
  videoBitrate: "Video bitrate",
  audioForwarding: "Forward audio",
  stayAwake: "Keep device awake",
  startFullscreen: "Start fullscreen",
  alwaysOnTop: "Always on top",
  launchPmp: "Open Panda Mouse Pro when mirroring starts",
  turnScreenOff: "Turn phone screen off after starting",
  mappingMode: "Keyboard & mouse mapping",
  mappingDescription: "Forwards all keyboard and mouse input directly to your phone.",
  enabledByDefault: "Enabled",
  virtualDisplayUnavailable: "Independent display mode",
  virtualDisplayDescription: "Play on your computer while keeping your phone free to use. Requires Android 10 or later.",
  experimental: "EXPERIMENTAL",
  shortcuts: "Shortcut reference",
  modDescription: "MOD = Command or Left Alt",
  releaseMouse: "Capture / release mouse",
  toggleFullscreen: "Enter / exit fullscreen",
  quitMirror: "Quit mirroring",
  togglePhoneScreen: "Toggle phone screen",
  goHome: "Go to Home",
  goBack: "Go back",
  recentTasks: "Recent apps",
  rotateScreen: "Rotate phone screen",
  adjustVolume: "Adjust volume",
  pasteClipboard: "Paste clipboard",
  keyboardSettings: "Open physical keyboard settings",
  toggleFps: "Show / hide FPS",
  shortcutNote: "On macOS, Command means the left ⌘ key; on Windows, use Left Alt. In mouse mapping mode, Left Command, Right Command, or Left Alt toggles mouse capture.",
  startMirror: "Start mirroring",
  startIndependentDisplay: "Start independent display",
  stopMirror: "Stop mirroring",
  activatePmp: "Activate Panda Mouse Pro",
  activatingPmp: "Starting and activating Panda Mouse Pro…",
  activationCommandCompleted: "Panda Mouse Pro activation command completed",
  checkingEnvironment: "Checking environment…",
  devicesFound: "Found {count} available device(s)",
  noDevices: "No authorized Android devices found",
  mirrorStarted: "Mirroring started · PID {pid}",
  mirrorStopped: "Mirroring stopped",
  mirrorWindowExited: "Mirror window closed",
  language: "Language",
  adbMissing: "adb was not found. Please reinstall Panda Gaming Desktop.",
  adbRunFailed: "Could not run adb: {detail}",
  launchPmpFailed: "Could not open Panda Mouse Pro: {detail}",
  activatePmpFailed: "Could not activate Panda Mouse Pro: {detail}",
  selectDeviceError: "Select a device first.",
  virtualDisplayError: "Independent display mode requires Android 10 or later: {detail}",
  scrcpyMissing: "scrcpy was not found. Please reinstall Panda Gaming Desktop.",
  processUnavailable: "The mirror process state is unavailable.",
  mirrorAlreadyRunning: "Mirroring is already running.",
  startFailed: "Could not start scrcpy: {detail}",
  stopFailed: "Could not stop scrcpy: {detail}"
};

export type MessageKey = keyof typeof zh;
const dictionaries = { "zh-CN": zh, en };

export function detectLocale(): Locale {
  const saved = localStorage.getItem("panda-locale");
  if (saved === "zh-CN" || saved === "en") return saved;
  return navigator.language.toLowerCase().startsWith("zh") ? "zh-CN" : "en";
}

export function translate(locale: Locale, key: MessageKey, values: Record<string, string | number> = {}) {
  return Object.entries(values).reduce(
    (message, [name, value]) => message.replaceAll(`{${name}}`, String(value)),
    dictionaries[locale][key]
  );
}

export function localizeBackendError(locale: Locale, error: unknown) {
  const raw = String(error);
  const exact: Record<string, MessageKey> = {
    "未找到 adb，请重新安装 Panda Gaming Desktop": "adbMissing",
    "请先选择设备": "selectDeviceError",
    "未找到 scrcpy，请重新安装 Panda Gaming Desktop": "scrcpyMissing",
    "镜像进程状态不可用": "processUnavailable",
    "镜像已经在运行": "mirrorAlreadyRunning"
  };
  if (exact[raw]) return translate(locale, exact[raw]);
  const prefixes: Array<[string, MessageKey]> = [
    ["无法运行 adb: ", "adbRunFailed"],
    ["无法启动 Panda Mouse Pro: ", "launchPmpFailed"],
    ["Panda Mouse Pro 激活失败: ", "activatePmpFailed"],
    ["独立投屏需要 Android 10 或更高版本: ", "virtualDisplayError"],
    ["启动 scrcpy 失败: ", "startFailed"],
    ["停止 scrcpy 失败: ", "stopFailed"]
  ];
  const match = prefixes.find(([prefix]) => raw.startsWith(prefix));
  return match ? translate(locale, match[1], { detail: raw.slice(match[0].length) }) : raw;
}
