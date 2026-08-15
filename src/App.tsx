import { useCallback, useEffect, useMemo, useState } from "react";
import { Cable, CircleStop, Gamepad2, MonitorPlay, RefreshCw, Settings2, Smartphone, TriangleAlert } from "lucide-react";
import { desktopApi } from "./api";
import type { Device, EnvironmentStatus, MirrorOptions, MirrorState } from "./types";

const defaults: MirrorOptions = {
  serial: "", maxSize: 1920, videoBitRateMbps: 12, maxFps: 60,
  turnScreenOff: false, stayAwake: true, fullscreen: false,
  borderless: false, audio: true, virtualDisplay: false
};

export default function App() {
  const [environment, setEnvironment] = useState<EnvironmentStatus | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);
  const [options, setOptions] = useState(defaults);
  const [mirror, setMirror] = useState<MirrorState>({ running: false, pid: null, serial: null });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("正在检查运行环境…");

  const refresh = useCallback(async () => {
    setBusy(true);
    try {
      const [env, found, state] = await Promise.all([desktopApi.environment(), desktopApi.devices(), desktopApi.state()]);
      setEnvironment(env); setDevices(found); setMirror(state);
      const usable = found.filter((device) => device.state === "device");
      setOptions((current) => ({ ...current, serial: usable.some((d) => d.serial === current.serial) ? current.serial : usable[0]?.serial ?? "" }));
      setMessage(usable.length ? `已发现 ${usable.length} 台可用设备` : "未发现已授权的 Android 设备");
    } catch (error) { setMessage(String(error)); } finally { setBusy(false); }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);
  const selected = useMemo(() => devices.find((device) => device.serial === options.serial), [devices, options.serial]);
  const ready = Boolean(environment?.adb.available && environment?.scrcpy.available && selected?.state === "device");

  async function toggleMirror() {
    setBusy(true);
    try {
      const state = mirror.running ? await desktopApi.stop() : await desktopApi.start(options);
      setMirror(state); setMessage(state.running ? `镜像已启动 · PID ${state.pid}` : "镜像已停止");
    } catch (error) { setMessage(String(error)); } finally { setBusy(false); }
  }

  function setOption<K extends keyof MirrorOptions>(key: K, value: MirrorOptions[K]) {
    setOptions((current) => ({ ...current, [key]: value }));
  }

  return <main className="app-shell">
    <header>
      <div className="brand-mark"><Gamepad2 size={22} /></div>
      <div><h1>Panda Gaming</h1><p>Android 桌面镜像控制台</p></div>
      <span className={`status-chip ${mirror.running ? "online" : ""}`}><i />{mirror.running ? "镜像运行中" : "待机"}</span>
    </header>

    <section className="hero panel">
      <div><span className="eyebrow">DEFAULT MIRROR MODE</span><h2>把手机画面带到桌面。</h2><p>基于本机 ADB 与 scrcpy，保持轻量、原生和低延迟。Panda Mouse Pro 可继续在手机侧工作。</p></div>
      <MonitorPlay size={104} strokeWidth={1.2} />
    </section>

    <div className="layout">
      <section className="panel devices-panel">
        <div className="section-title"><div><Smartphone size={18}/><h3>选择设备</h3></div><button className="icon-button" onClick={() => void refresh()} disabled={busy} title="刷新"><RefreshCw size={17} className={busy ? "spin" : ""}/></button></div>
        {!devices.length && <div className="empty"><Cable size={34}/><strong>等待 USB 或无线设备</strong><span>开启 USB 调试并允许此电脑进行调试</span></div>}
        <div className="device-list">{devices.map((device) => <button key={device.serial} className={`device ${options.serial === device.serial ? "selected" : ""}`} onClick={() => setOption("serial", device.serial)} disabled={device.state !== "device" || mirror.running}>
          <span className="phone-icon"><Smartphone size={20}/></span><span><strong>{device.model ?? device.serial}</strong><small>{device.serial}</small></span><em>{device.state === "device" ? "已连接" : device.state === "unauthorized" ? "未授权" : device.state}</em>
        </button>)}</div>
        <div className="tool-status"><Tool label="ADB" info={environment?.adb}/><Tool label="scrcpy" info={environment?.scrcpy}/></div>
      </section>

      <section className="panel settings-panel">
        <div className="section-title"><div><Settings2 size={18}/><h3>镜像设置</h3></div><span>推荐配置</span></div>
        <div className="settings-grid">
          <Field label="最高分辨率"><select value={options.maxSize} onChange={(e) => setOption("maxSize", Number(e.target.value))} disabled={mirror.running}><option value={1280}>1280p</option><option value={1600}>1600p</option><option value={1920}>1920p</option><option value={2560}>2560p</option></select></Field>
          <Field label="最高帧率"><select value={options.maxFps} onChange={(e) => setOption("maxFps", Number(e.target.value))} disabled={mirror.running}><option value={30}>30 FPS</option><option value={60}>60 FPS</option><option value={90}>90 FPS</option><option value={120}>120 FPS</option></select></Field>
          <Field label="视频码率"><select value={options.videoBitRateMbps} onChange={(e) => setOption("videoBitRateMbps", Number(e.target.value))} disabled={mirror.running}><option value={4}>4 Mbps</option><option value={8}>8 Mbps</option><option value={12}>12 Mbps</option><option value={20}>20 Mbps</option></select></Field>
        </div>
        <div className="toggles">
          <Toggle label="声音转发" checked={options.audio} onChange={(v) => setOption("audio", v)} disabled={mirror.running}/>
          <Toggle label="保持设备唤醒" checked={options.stayAwake} onChange={(v) => setOption("stayAwake", v)} disabled={mirror.running}/>
          <Toggle label="启动后关闭手机屏幕" checked={options.turnScreenOff} onChange={(v) => setOption("turnScreenOff", v)} disabled={mirror.running}/>
          <Toggle label="无边框窗口" checked={options.borderless} onChange={(v) => setOption("borderless", v)} disabled={mirror.running}/>
        </div>
        <div className="experimental"><TriangleAlert size={18}/><div><strong>Virtual display 暂未开放</strong><p>已在后端参数模型中预留；待 Panda Mouse Pro 适配完善后再作为实验功能启用。</p></div><span>EXPERIMENTAL</span></div>
      </section>
    </div>

    <footer><div className="footer-message"><i className={ready ? "ok" : ""}/><span>{message}</span></div><button className={`primary ${mirror.running ? "danger" : ""}`} onClick={() => void toggleMirror()} disabled={busy || (!mirror.running && !ready)}>{mirror.running ? <CircleStop size={19}/> : <MonitorPlay size={19}/>} {mirror.running ? "停止镜像" : "启动镜像"}</button></footer>
  </main>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="field"><span>{label}</span>{children}</label>; }
function Toggle({ label, checked, onChange, disabled }: { label: string; checked: boolean; onChange: (value: boolean) => void; disabled: boolean }) { return <label className="toggle-row"><span>{label}</span><input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} disabled={disabled}/><i /></label>; }
function Tool({ label, info }: { label: string; info?: EnvironmentStatus["adb"] }) { return <div><span className={info?.available ? "dot-ok" : "dot-bad"}/><span>{label}</span><small>{info?.available ? info.version ?? "可用" : "未找到"}</small></div>; }
