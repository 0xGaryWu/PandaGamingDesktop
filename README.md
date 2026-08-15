# Panda Gaming Desktop

一个轻量的 Windows/macOS Android 镜像控制台。界面使用 React + TypeScript，原生命令与进程管理使用 Tauri/Rust，镜像由本机 `scrcpy` 提供。

## 当前范围

- 自动检测 `adb` 与 `scrcpy`
- 列出 USB/无线 ADB 设备及授权状态
- 使用指定设备启动、监控和停止 scrcpy
- 分辨率、帧率、码率、音频、保持唤醒、息屏、全屏和置顶设置
- 默认传入 `-K -M`，通过 UHID 键盘和鼠标进入键鼠映射模式
- 默认传入 `--mouse-bind=++++:++++`，让 Shift 组合下的鼠标按键也完整透传
- 内置常用 scrcpy 快捷键速查
- 默认使用主显示屏镜像，兼容 Panda Mouse Pro 当前工作方式
- virtual display 参数模型已预留，但 UI 和后端均明确禁止启用

## 本地开发

需要 Node.js、Rust，以及已安装的 Android Platform Tools 和 scrcpy。

```bash
npm install
npm run tauri dev
```

只检查 Web 界面：

```bash
npm run dev
```

生产构建：

```bash
npm run tauri build
```

## 工具查找

应用首先按系统 `PATH` 查找命令，另外支持以下常见位置：

- macOS：`/opt/homebrew/bin`、`/usr/local/bin`、`~/Library/Android/sdk/platform-tools`
- Windows：`%LOCALAPPDATA%/Android/Sdk/platform-tools`

正式分发时可进一步选择把对应平台的 adb/scrcpy 作为 Tauri sidecar 一起打包，换取开箱即用；当前版本优先复用本机安装，以保持应用安装包小巧。

## Virtual display 路线

后续实验版可把 scrcpy `--new-display` 封装为独立模式，并增加应用启动、分辨率/DPI、兼容性检测和明确的回退入口。在 Panda Mouse Pro 完成适配前，它不会影响默认镜像流程。
