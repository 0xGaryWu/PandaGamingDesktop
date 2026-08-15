# Panda Gaming Desktop

一个轻量的 Windows/macOS Android 镜像控制台。界面使用 React + TypeScript，原生命令与进程管理使用 Tauri/Rust，镜像由本机 `scrcpy` 提供。

## 当前范围

- 自动检测 `adb` 与 `scrcpy`
- 列出 USB/无线 ADB 设备及授权状态
- 使用指定设备启动、监控和停止 scrcpy
- 分辨率、帧率、码率、音频、保持唤醒、息屏、全屏和置顶设置
- 默认传入 `-K -M`，通过 UHID 键盘和鼠标进入键鼠映射模式
- 默认传入 `--mouse-bind=++++:++++`，让 Shift 组合下的鼠标按键也完整透传
- 默认通过 `--start-app=com.panda.mouse` 启动 Panda Mouse Pro，可在界面中关闭
- 内置常用 scrcpy 快捷键速查
- 默认使用主显示屏镜像，兼容 Panda Mouse Pro 当前工作方式
- virtual display 参数模型已预留，但 UI 和后端均明确禁止启用

## 本地开发

需要 Node.js 和 Rust。直接运行开发模式时可以使用系统已安装的 Android Platform Tools 和 scrcpy：

```bash
npm install
npm run tauri dev
```

只检查 Web 界面：

```bash
npm run dev
```

## 正式打包

在当前系统上生成包含 adb、scrcpy 和 scrcpy-server 的安装包：

```bash
npm run package
```

脚本会自动完成以下工作：

1. 根据 Windows/Linux/macOS 和 CPU 架构选择 scrcpy 4.1 官方便携包。
2. 下载并校验固定的 SHA-256。
3. 将官方包中的 adb、scrcpy、scrcpy-server 及运行库完整放入 Tauri resources。
4. 调用 `tauri build` 生成当前平台安装包。

安装包输出位于 `src-tauri/target/release/bundle/`。Tauri 不支持从一个操作系统直接生成所有平台的原生安装包；仓库内的 `.github/workflows/release.yml` 会并行构建：

- Windows x64：NSIS `.exe`
- Linux x64：AppImage 和 `.deb`
- macOS Apple Silicon：`.dmg`
- macOS Intel：`.dmg`

推送 `v*` 标签或在 GitHub Actions 手动运行 **Build desktop release** 后，构建结果会上传到同一个草稿 GitHub Release，确认无误后即可发布。

## 工具查找

正式安装包优先使用其 resources 中的工具。开发构建没有运行 `npm run tools:prepare` 时，应用会按系统 `PATH` 查找命令，另外支持以下常见位置：

- macOS：`/opt/homebrew/bin`、`/usr/local/bin`、`~/Library/Android/sdk/platform-tools`
- Windows：`%LOCALAPPDATA%/Android/Sdk/platform-tools`

scrcpy 官方便携包中已经包含对应平台的 adb 和匹配版本的 scrcpy-server，因此正式分发不要求用户安装 Homebrew、Android Studio或配置 PATH。

### 发布前注意事项

- macOS 未配置 Apple Developer 签名和公证时，用户会遇到 Gatekeeper 警告。
- Windows 未配置代码签名证书时，SmartScreen 可能显示“未知发布者”。
- 首次发布前应分别在干净的 Windows、Linux、Intel Mac 和 Apple Silicon Mac 上测试安装、USB 调试授权、启动镜像及卸载。

## Virtual display 路线

后续实验版可把 scrcpy `--new-display` 封装为独立模式，并增加应用启动、分辨率/DPI、兼容性检测和明确的回退入口。在 Panda Mouse Pro 完成适配前，它不会影响默认镜像流程。
