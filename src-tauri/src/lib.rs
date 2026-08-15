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
    let mut parts = line.split_whitespace();
    let serial = parts.next()?.to_string();
    let state = parts.next()?.to_string();
    let mut device = Device {
        serial,
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

fn activate_pmp_blocking(serial: String, app: AppHandle) -> Result<(), String> {
    if serial.trim().is_empty() {
        return Err("请先选择设备".into());
    }
    let adb = resolve_tool("adb", &app).ok_or("未找到 adb，请重新安装 Panda Gaming Desktop")?;
    let launch = hidden_command(&adb)
        .args([
            "-s",
            &serial,
            "shell",
            "monkey",
            "-p",
            "com.panda.mouse",
            "-c",
            "android.intent.category.LAUNCHER",
            "1",
        ])
        .output()
        .map_err(|error| format!("无法启动 Panda Mouse Pro: {error}"))?;
    if !launch.status.success() {
        return Err(format!(
            "无法启动 Panda Mouse Pro: {}",
            command_error(&launch)
        ));
    }

    thread::sleep(Duration::from_secs(3));

    let activation = hidden_command(adb)
        .args([
            "-s",
            &serial,
            "shell",
            "sh",
            "/sdcard/Android/data/com.panda.mouse/files/scripts/activate.sh",
        ])
        .output()
        .map_err(|error| format!("Panda Mouse Pro 激活失败: {error}"))?;
    if !activation.status.success() {
        return Err(format!(
            "Panda Mouse Pro 激活失败: {}",
            command_error(&activation)
        ));
    }
    Ok(())
}

#[tauri::command]
async fn activate_pmp(serial: String, app: AppHandle) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || activate_pmp_blocking(serial, app))
        .await
        .map_err(|error| format!("Panda Mouse Pro 激活失败: {error}"))?
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
    if options.virtual_display {
        return Err("Virtual display 仍为实验功能，当前版本尚未开放".into());
    }
    let scrcpy =
        resolve_tool("scrcpy", &app).ok_or("未找到 scrcpy，请重新安装 Panda Gaming Desktop")?;
    let adb = resolve_tool("adb", &app).ok_or("未找到 adb，请重新安装 Panda Gaming Desktop")?;
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
    let mut command = hidden_command(scrcpy);
    command.env("ADB", adb);
    if let Ok(server) = app
        .path()
        .resolve("tools/scrcpy-server", BaseDirectory::Resource)
    {
        if server.is_file() {
            command.env("SCRCPY_SERVER_PATH", server);
        }
    }
    command.args([
        "--serial",
        &options.serial,
        "-K",
        "-M",
        "--mouse-bind=++++:++++",
        "--max-size",
        &options.max_size.to_string(),
        "--video-bit-rate",
        &format!("{}M", options.video_bit_rate_mbps),
        "--max-fps",
        &options.max_fps.to_string(),
        "--window-title",
        "Panda Gaming Mirror",
    ]);
    if options.turn_screen_off {
        command.arg("--turn-screen-off");
    }
    if options.stay_awake {
        command.arg("--stay-awake");
    }
    if options.fullscreen {
        command.arg("--fullscreen");
    }
    if !options.audio {
        command.arg("--no-audio");
    }
    if options.always_on_top {
        command.arg("--always-on-top");
    }
    if options.launch_panda_mouse_pro {
        command.arg("--start-app=com.panda.mouse");
    }
    let child = command
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
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
            activate_pmp,
            start_mirror,
            stop_mirror,
            mirror_state
        ])
        .run(tauri::generate_context!())
        .expect("error while running Panda Gaming Desktop");
}
