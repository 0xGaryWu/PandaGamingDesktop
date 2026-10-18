use serde::{Deserialize, Serialize};
use std::{
    ffi::OsStr,
    path::{Path, PathBuf},
    process::{Child, Command, Stdio},
    sync::Mutex,
    thread,
    time::Duration,
};
use tauri::{path::BaseDirectory, AppHandle, Manager, State};

#[derive(Default)]
struct MirrorProcess(Mutex<Option<RunningMirror>>);

struct RunningMirror {
    child: Child,
    serial: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ToolInfo {
    available: bool,
    path: Option<String>,
    version: Option<String>,
}

#[derive(Serialize)]
struct EnvironmentStatus {
    adb: ToolInfo,
    scrcpy: ToolInfo,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Device {
    serial: String,
    state: String,
    model: Option<String>,
    product: Option<String>,
    transport_id: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct MirrorOptions {
    serial: String,
    max_size: u32,
    video_bit_rate_mbps: u32,
    max_fps: u32,
    turn_screen_off: bool,
    stay_awake: bool,
    fullscreen: bool,
    audio: bool,
    always_on_top: bool,
    launch_panda_mouse_pro: bool,
    virtual_display: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct MirrorState {
    running: bool,
    pid: Option<u32>,
    serial: Option<String>,
}

fn hidden_command<S: AsRef<OsStr>>(program: S) -> Command {
    let command = Command::new(program);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        let mut command = command;
        command.creation_flags(CREATE_NO_WINDOW);
        command
    }
    #[cfg(not(windows))]
    {
        command
    }
}

fn candidate_paths(tool: &str, app: &AppHandle) -> Vec<PathBuf> {
    let executable = if cfg!(windows) {
        format!("{tool}.exe")
    } else {
        tool.to_string()
    };
    let mut paths = Vec::new();
    if let Ok(bundled) = app
        .path()
        .resolve(format!("tools/{executable}"), BaseDirectory::Resource)
    {
        paths.push(bundled);
    }
    paths.push(PathBuf::from(&executable));
    if cfg!(target_os = "macos") {
        paths
            .extend(["/opt/homebrew/bin", "/usr/local/bin"].map(|base| Path::new(base).join(tool)));
        if let Some(home) = std::env::var_os("HOME") {
            paths.push(
                PathBuf::from(home)
                    .join("Library/Android/sdk/platform-tools")
                    .join(tool),
            );
        }
    } else if cfg!(windows) {
        if let Some(local) = std::env::var_os("LOCALAPPDATA") {
            paths.push(
                PathBuf::from(local)
                    .join("Android/Sdk/platform-tools")
                    .join(&executable),
            );
        }
    }
    paths
}

fn resolve_tool(tool: &str, app: &AppHandle) -> Option<PathBuf> {
    candidate_paths(tool, app).into_iter().find(|candidate| {
        hidden_command(candidate)
            .arg("--version")
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status()
            .is_ok()
    })
}

fn tool_info(tool: &str, app: &AppHandle) -> ToolInfo {
    let Some(path) = resolve_tool(tool, app) else {
        return ToolInfo {
            available: false,
            path: None,
            version: None,
        };
    };
    let output = hidden_command(&path).arg("--version").output().ok();
    let version = output
        .map(|out| {
            let text = if out.stdout.is_empty() {
                String::from_utf8_lossy(&out.stderr)
            } else {
                String::from_utf8_lossy(&out.stdout)
            };
            text.lines().next().unwrap_or_default().trim().to_string()
        })
        .filter(|line| !line.is_empty());
    ToolInfo {
        available: true,
        path: Some(path.to_string_lossy().into_owned()),
        version,
    }
}

#[tauri::command]
fn check_environment(app: AppHandle) -> EnvironmentStatus {
    EnvironmentStatus {
        adb: tool_info("adb", &app),
        scrcpy: tool_info("scrcpy", &app),
    }
}

#[tauri::command]
fn list_devices(app: AppHandle) -> Result<Vec<Device>, String> {
    let adb = resolve_tool("adb", &app).ok_or("未找到 adb，请重新安装 Panda Gaming Desktop")?;
    let output = hidden_command(adb)
        .args(["devices", "-l"])
        .output()
        .map_err(|error| format!("无法运行 adb: {error}"))?;
    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).trim().to_string());
    }
    Ok(String::from_utf8_lossy(&output.stdout)
        .lines()
        .skip(1)
        .filter_map(parse_device)
        .collect())
}

fn parse_device(line: &str) -> Option<Device> {
    // Most adb versions use a tab between the serial and state, but some builds
    // print aligned spaces instead. An mDNS instance may itself contain spaces
    // (for example " (2)"), so locate the known state column without splitting
    // the serial itself on whitespace.
    let (serial, details) = split_device_columns(line)?;
    let serial = serial.trim();
    if serial.is_empty() {
        return None;
    }
    let mut parts = details.split_whitespace();
    let state = parts.next()?.to_string();
    let mut device = Device {
        serial: serial.to_string(),
        state,
        model: None,
        product: None,
        transport_id: None,
    };
    for field in parts {
        if let Some((key, value)) = field.split_once(':') {
            match key {
                "model" => device.model = Some(value.replace('_', " ")),
                "product" => device.product = Some(value.to_string()),
                "transport_id" => device.transport_id = Some(value.to_string()),
                _ => {}
            }
        }
    }
    Some(device)
}

fn split_device_columns(line: &str) -> Option<(&str, &str)> {
    if let Some(columns) = line.split_once('\t') {
        return Some(columns);
    }

    const STATES: &[&str] = &[
        "device",
        "offline",
        "unauthorized",
        "recovery",
        "sideload",
        "bootloader",
        "host",
        "no permissions",
    ];

    STATES.iter().find_map(|state| {
        let marker = format!(" {state}");
        line.find(&marker).and_then(|index| {
            let after_state = &line[index + marker.len()..];
            if after_state
                .chars()
                .next()
                .is_some_and(|character| !character.is_whitespace())
            {
                return None;
            }
            let serial = &line[..index];
            if serial.trim().is_empty() {
                None
            } else {
                Some((serial, line[index..].trim_start()))
            }
        })
    })
}

#[cfg(test)]
mod tests {
    use super::parse_device;

    #[test]
    fn parses_usb_device() {
        let device =
            parse_device("RFCX500CHSL\tdevice product:gts8wifi model:SM_S921U1 transport_id:1")
                .expect("USB device should parse");

        assert_eq!(device.serial, "RFCX500CHSL");
        assert_eq!(device.state, "device");
        assert_eq!(device.model.as_deref(), Some("SM S921U1"));
        assert_eq!(device.product.as_deref(), Some("gts8wifi"));
        assert_eq!(device.transport_id.as_deref(), Some("1"));
    }

    #[test]
    fn preserves_spaces_in_wireless_mdns_serial() {
        let device = parse_device(
            "adb-10CF2C1B8C001C0-XpTc8I (2)._adb-tls-connect._tcp\tdevice product:e3q model:SM_S9280 transport_id:3",
        )
        .expect("wireless device should parse");

        assert_eq!(
            device.serial,
            "adb-10CF2C1B8C001C0-XpTc8I (2)._adb-tls-connect._tcp"
        );
        assert_eq!(device.state, "device");
        assert_eq!(device.model.as_deref(), Some("SM S9280"));
    }

    #[test]
    fn parses_space_separated_tcpip_device() {
        let device =
            parse_device("192.168.3.27:39627    device product:e3q model:SM_S9280 transport_id:4")
                .expect("space-separated TCP/IP device should parse");

        assert_eq!(device.serial, "192.168.3.27:39627");
        assert_eq!(device.state, "device");
        assert_eq!(device.transport_id.as_deref(), Some("4"));
    }

    #[test]
    fn parses_minimal_tcpip_device_line() {
        let device =
            parse_device("192.168.3.27:39627\tdevice").expect("minimal TCP/IP device should parse");

        assert_eq!(device.serial, "192.168.3.27:39627");
        assert_eq!(device.state, "device");
    }

    #[test]
    fn parses_minimal_space_separated_tcpip_device_line() {
        let device = parse_device("192.168.3.27:39627    device")
            .expect("minimal space-separated TCP/IP device should parse");

        assert_eq!(device.serial, "192.168.3.27:39627");
        assert_eq!(device.state, "device");
    }

    #[test]
    fn keeps_unauthorized_device_visible() {
        let device = parse_device("RFCX500CHSL    unauthorized usb:1-2 transport_id:5")
            .expect("unauthorized device should parse");

        assert_eq!(device.serial, "RFCX500CHSL");
        assert_eq!(device.state, "unauthorized");
    }

    #[test]
    fn ignores_header_and_blank_lines() {
        assert!(parse_device("List of devices attached").is_none());
        assert!(parse_device("").is_none());
    }

    #[test]
    fn preserves_mdns_spaces_when_columns_are_space_separated() {
        let device = parse_device(
            "adb-10CF2C1B8C001C0-XpTc8I (2)._adb-tls-connect._tcp    device product:e3q model:SM_S9280",
        )
        .expect("space-separated wireless device should parse");

        assert_eq!(
            device.serial,
            "adb-10CF2C1B8C001C0-XpTc8I (2)._adb-tls-connect._tcp"
        );
        assert_eq!(device.state, "device");
    }
}

fn command_error(output: &std::process::Output) -> String {
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    if !stderr.is_empty() {
        return stderr;
    }
    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if stdout.is_empty() {
        format!("exit code {}", output.status.code().unwrap_or(-1))
    } else {
        stdout
    }
}

fn android_sdk(adb: &Path, serial: &str) -> Result<u32, String> {
    let output = hidden_command(adb)
        .args(["-s", serial, "shell", "getprop", "ro.build.version.sdk"])
        .output()
        .map_err(|error| format!("无法运行 adb: {error}"))?;
    if !output.status.success() {
        return Err(format!("无法运行 adb: {}", command_error(&output)));
    }
    String::from_utf8_lossy(&output.stdout)
        .trim()
        .parse()
        .map_err(|_| "无法读取 Android SDK 版本".to_string())
}

struct ActivationTarget {
    name: &'static str,
    package_name: &'static str,
    script_path: &'static str,
}

const ACTIVATION_TARGETS: &[ActivationTarget] = &[
    ActivationTarget {
        name: "Panda Mouse Pro",
        package_name: "com.panda.mouse",
        script_path: "/sdcard/Android/data/com.panda.mouse/files/scripts/activate.sh",
    },
    ActivationTarget {
        name: "Panda Gamepad Pro",
        package_name: "com.panda.gamepad",
        script_path: "/sdcard/Android/data/com.panda.gamepad/files/scripts/activate.sh",
    },
    ActivationTarget {
        name: "Panda Touch Pro",
        package_name: "com.panda.touch",
        script_path: "/sdcard/Android/data/com.panda.touch/files/scripts/activate.sh",
    },
];

fn is_package_installed(adb: &Path, serial: &str, package_name: &str) -> Result<bool, String> {
    let output = hidden_command(adb)
        .args([
            "-s",
            serial,
            "shell",
            "pm",
            "list",
            "packages",
            package_name,
        ])
        .output()
        .map_err(|error| format!("无法运行 adb: {error}"))?;
    if !output.status.success() {
        return Err(format!("无法运行 adb: {}", command_error(&output)));
    }
    let expected = format!("package:{package_name}");
    Ok(String::from_utf8_lossy(&output.stdout)
        .lines()
        .any(|line| line.trim() == expected))
}

fn activate_apps_blocking(serial: String, app: AppHandle) -> Result<String, String> {
    if serial.trim().is_empty() {
        return Err("请先选择设备".into());
    }
    let adb = resolve_tool("adb", &app).ok_or("未找到 adb，请重新安装 Panda Gaming Desktop")?;
    let target = ACTIVATION_TARGETS
        .iter()
        .find_map(
            |target| match is_package_installed(&adb, &serial, target.package_name) {
                Ok(true) => Some(Ok(target)),
                Ok(false) => None,
                Err(error) => Some(Err(error)),
            },
        )
        .transpose()?
        .ok_or("未安装受支持的 Panda 映射 App")?;

    let launch = hidden_command(&adb)
        .args([
            "-s",
            &serial,
            "shell",
            "monkey",
            "-p",
            target.package_name,
            "-c",
            "android.intent.category.LAUNCHER",
            "1",
        ])
        .output()
        .map_err(|error| format!("无法启动映射 App: {}: {error}", target.name))?;
    if !launch.status.success() {
        return Err(format!(
            "无法启动映射 App: {}: {}",
            target.name,
            command_error(&launch)
        ));
    }

    thread::sleep(Duration::from_secs(3));

    let activation = hidden_command(adb)
        .args(["-s", &serial, "shell", "sh", target.script_path])
        .output()
        .map_err(|error| format!("Panda App 激活失败: {}: {error}", target.name))?;
    if !activation.status.success() {
        return Err(format!(
            "Panda App 激活失败: {}: {}",
            target.name,
            command_error(&activation)
        ));
    }
    Ok(target.name.to_string())
}

#[tauri::command]
async fn activate_apps(serial: String, app: AppHandle) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || activate_apps_blocking(serial, app))
        .await
        .map_err(|error| format!("Panda App 激活失败: {error}"))?
}

#[tauri::command]
fn start_mirror(
    options: MirrorOptions,
    process: State<'_, MirrorProcess>,
    app: AppHandle,
) -> Result<MirrorState, String> {
    if options.serial.trim().is_empty() {
        return Err("请先选择设备".into());
    }
    let scrcpy =
        resolve_tool("scrcpy", &app).ok_or("未找到 scrcpy，请重新安装 Panda Gaming Desktop")?;
    let adb = resolve_tool("adb", &app).ok_or("未找到 adb，请重新安装 Panda Gaming Desktop")?;
    if options.virtual_display {
        let sdk = android_sdk(&adb, &options.serial)?;
        if sdk < 29 {
            return Err(format!(
                "独立投屏需要 Android 10 或更高版本: 当前设备为 SDK {sdk}"
            ));
        }
    }
    let mut guard = process.0.lock().map_err(|_| "镜像进程状态不可用")?;
    if let Some(running) = guard.as_mut() {
        if running
            .child
            .try_wait()
            .map_err(|error| error.to_string())?
            .is_none()
        {
            return Err("镜像已经在运行".into());
        }
        *guard = None;
    }
    let mut arguments = vec![
        "--serial".to_string(),
        options.serial.clone(),
        "-K".to_string(),
        "-M".to_string(),
        "--mouse-bind=++++:++++".to_string(),
        "--max-size".to_string(),
        options.max_size.to_string(),
        "--video-bit-rate".to_string(),
        format!("{}M", options.video_bit_rate_mbps),
        "--max-fps".to_string(),
        options.max_fps.to_string(),
        "--window-title".to_string(),
        "Panda Gaming Mirror".to_string(),
    ];
    if options.virtual_display {
        let height = options.max_size.saturating_mul(9) / 16;
        arguments.push(format!("--new-display={}x{}", options.max_size, height));
        arguments.push("--display-ime-policy=local".to_string());
    }
    if options.turn_screen_off && !options.virtual_display {
        arguments.push("--turn-screen-off".to_string());
    }
    if options.stay_awake {
        arguments.push(
            if options.virtual_display {
                "--keep-active"
            } else {
                "--stay-awake"
            }
            .to_string(),
        );
    }
    if options.fullscreen {
        arguments.push("--fullscreen".to_string());
    }
    if !options.audio {
        arguments.push("--no-audio".to_string());
    }
    if options.always_on_top {
        arguments.push("--always-on-top".to_string());
    }
    if options.launch_panda_mouse_pro || options.virtual_display {
        arguments.push("--start-app=com.panda.mouse".to_string());
    }

    let mut command = hidden_command(&scrcpy);
    command
        .args(&arguments)
        .stdout(Stdio::null())
        .stderr(Stdio::null());
    #[cfg(windows)]
    {
        let tools_dir = scrcpy.parent().ok_or("无法定位 scrcpy 工具目录")?;
        command.current_dir(tools_dir);
    }

    command.env("ADB", &adb);
    #[cfg(not(windows))]
    {
        if let Ok(server) = app
            .path()
            .resolve("tools/scrcpy-server", BaseDirectory::Resource)
        {
            if server.is_file() {
                command.env("SCRCPY_SERVER_PATH", server);
            }
        }
    }
    let child = command
        .stdin(Stdio::null())
        .spawn()
        .map_err(|error| format!("启动 scrcpy 失败: {error}"))?;
    let state = MirrorState {
        running: true,
        pid: Some(child.id()),
        serial: Some(options.serial.clone()),
    };
    *guard = Some(RunningMirror {
        child,
        serial: options.serial,
    });
    Ok(state)
}

#[tauri::command]
fn stop_mirror(process: State<'_, MirrorProcess>) -> Result<MirrorState, String> {
    let mut guard = process.0.lock().map_err(|_| "镜像进程状态不可用")?;
    if let Some(mut running) = guard.take() {
        running
            .child
            .kill()
            .map_err(|error| format!("停止 scrcpy 失败: {error}"))?;
        let _ = running.child.wait();
    }
    Ok(MirrorState {
        running: false,
        pid: None,
        serial: None,
    })
}

#[tauri::command]
fn mirror_state(process: State<'_, MirrorProcess>) -> Result<MirrorState, String> {
    let mut guard = process.0.lock().map_err(|_| "镜像进程状态不可用")?;
    let Some(running) = guard.as_mut() else {
        return Ok(MirrorState {
            running: false,
            pid: None,
            serial: None,
        });
    };
    if running
        .child
        .try_wait()
        .map_err(|error| error.to_string())?
        .is_some()
    {
        *guard = None;
        return Ok(MirrorState {
            running: false,
            pid: None,
            serial: None,
        });
    }
    Ok(MirrorState {
        running: true,
        pid: Some(running.child.id()),
        serial: Some(running.serial.clone()),
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(MirrorProcess::default())
        .invoke_handler(tauri::generate_handler![
            check_environment,
            list_devices,
            activate_apps,
            start_mirror,
            stop_mirror,
            mirror_state
        ])
        .run(tauri::generate_context!())
        .expect("error while running Panda Gaming Desktop");
}
