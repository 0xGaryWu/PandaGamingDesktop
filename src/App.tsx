import { useCallback, useEffect, useMemo, useState } from "react";
import { Cable, CircleStop, Command, Keyboard, MonitorPlay, MousePointer2, RefreshCw, Settings2, Smartphone, TriangleAlert, Zap } from "lucide-react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { desktopApi } from "./api";
import type { Device, EnvironmentStatus, MirrorOptions, MirrorState } from "./types";
import { detectLocale, localizeBackendError, translate, type Locale, type MessageKey } from "./i18n";
import pandaStudioMark from "./assets/panda-studio-mark.png";
import packageMetadata from "../package.json";

type Notice = { key: MessageKey; values?: Record<string, string | number> } | { raw: string };

const defaults: MirrorOptions = {
  serial: "", maxSize: 1920, videoBitRateMbps: 12, maxFps: 60,
  turnScreenOff: false, stayAwake: true, fullscreen: false,
  audio: true, alwaysOnTop: false,
  launchPandaMousePro: true, virtualDisplay: false
};

export default function App() {
  const [locale, setLocale] = useState<Locale>(detectLocale);
  const [environment, setEnvironment] = useState<EnvironmentStatus | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);
  const [options, setOptions] = useState(defaults);
  const [mirror, setMirror] = useState<MirrorState>({ running: false, pid: null, serial: null, error: null });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>({ key: "checkingEnvironment" });
  const t = useCallback((key: MessageKey, values?: Record<string, string | number>) => translate(locale, key, values), [locale]);

  const refresh = useCallback(async () => {
    setBusy(true);
    try {
      const [env, found, state] = await Promise.all([desktopApi.environment(), desktopApi.devices(), desktopApi.state()]);
      setEnvironment(env); setDevices(found); setMirror(state);
      const usable = found.filter((device) => device.state === "device");
      setOptions((current) => ({ ...current, serial: usable.some((d) => d.serial === current.serial) ? current.serial : usable[0]?.serial ?? "" }));
      setNotice(usable.length ? { key: "devicesFound", values: { count: usable.length } } : { key: "noDevices" });
    } catch (error) { setNotice({ raw: localizeBackendError(locale, error) }); } finally { setBusy(false); }
  }, [locale]);

  useEffect(() => { void refresh(); }, [refresh]);

  useEffect(() => {
    let cancelled = false;
    let refreshing = false;

    async function refreshDevicesSilently() {
      if (refreshing) return;
      refreshing = true;
      try {
        const found = await desktopApi.devices();
        if (cancelled) return;
        setDevices(found);
        const usable = found.filter((device) => device.state === "device");
        setOptions((current) => ({
          ...current,
          serial: usable.some((device) => device.serial === current.serial)
            ? current.serial
            : usable[0]?.serial ?? ""
        }));
      } catch {
        // Keep the last known device list during transient adb failures.
      } finally {
        refreshing = false;
      }
    }

    const handleFocus = () => { void refreshDevicesSilently(); };
    const timer = window.setInterval(() => {
      if (document.hasFocus()) void refreshDevicesSilently();
    }, 2000);
    window.addEventListener("focus", handleFocus);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener("focus", handleFocus);
    };
  }, []);

  useEffect(() => {
    localStorage.setItem("panda-locale", locale);
    document.documentElement.lang = locale;
  }, [locale]);

  useEffect(() => {
    async function syncMirrorState() {
      try {
        const state = await desktopApi.state();
        if (mirror.running && !state.running) {
          setNotice(state.error ? { key: "mirrorWindowExitedWithError", values: { detail: state.error } } : { key: "mirrorWindowExited" });
        }
        setMirror(state);
      } catch {
        // A temporary status query failure should not interrupt an active mirror.
      }
    }

    const handleFocus = () => { void syncMirrorState(); };
    window.addEventListener("focus", handleFocus);
    if (!mirror.running) return () => window.removeEventListener("focus", handleFocus);

    const timer = window.setInterval(() => { void syncMirrorState(); }, 750);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", handleFocus);
    };
  }, [mirror.running]);

  const selected = useMemo(() => devices.find((device) => device.serial === options.serial), [devices, options.serial]);
  const ready = Boolean(environment?.adb.available && environment?.scrcpy.available && selected?.state === "device");
  const canActivatePmp = Boolean(environment?.adb.available && selected?.state === "device");

  async function toggleMirror() {
    setBusy(true);
    try {
      const state = mirror.running ? await desktopApi.stop() : await desktopApi.start(options);
      setMirror(state); setNotice(state.running ? { key: "mirrorStarted", values: { pid: state.pid ?? "—" } } : { key: "mirrorStopped" });
    } catch (error) { setNotice({ raw: localizeBackendError(locale, error) }); } finally { setBusy(false); }
  }

  async function activatePmp() {
    if (!options.serial) return;
    setBusy(true);
    setNotice({ key: "activatingPmp" });
    try {
      await desktopApi.activatePmp(options.serial);
      setNotice({ key: "activationCommandCompleted" });
    } catch (error) {
      setNotice({ raw: localizeBackendError(locale, error) });
    } finally {
      setBusy(false);
    }
  }

  function setOption<K extends keyof MirrorOptions>(key: K, value: MirrorOptions[K]) {
    setOptions((current) => ({ ...current, [key]: value }));
  }

  function setVirtualDisplay(enabled: boolean) {
    setOptions((current) => ({
      ...current,
      virtualDisplay: enabled,
      turnScreenOff: enabled ? false : current.turnScreenOff,
      launchPandaMousePro: enabled ? true : current.launchPandaMousePro
    }));
  }

  const message = "raw" in notice ? notice.raw : t(notice.key, notice.values);

  return <main className="app-shell">
    <header>
      <div className="brand-mark"><img src={pandaStudioMark} alt="Panda Gaming Studio" /></div>
      <div className="brand-copy"><h1>{t("appTitle")}</h1><p>{t("appDescriptionBefore")} <a href="https://github.com/Genymobile/scrcpy" onClick={(event) => { event.preventDefault(); void openUrl("https://github.com/Genymobile/scrcpy"); }}>scrcpy</a>{t("appDescriptionAfter")}</p></div>
      <select className="language-select" value={locale} onChange={(event) => setLocale(event.target.value as Locale)} aria-label={t("language")}><option value="zh-CN">中文</option><option value="en">EN</option></select>
      <span className={`status-chip ${mirror.running ? "online" : ""}`}><i />{mirror.running ? t("mirrorRunning") : t("standby")}</span>
    </header>

    <div className="layout">
      <section className="panel devices-panel">
        <div className="section-title"><div><Smartphone size={18}/><h3>{t("selectDevice")}</h3></div><button className="icon-button" onClick={() => void refresh()} disabled={busy} title={t("refresh")}><RefreshCw size={17} className={busy ? "spin" : ""}/></button></div>
        {!devices.length && <div className="empty"><Cable size={34}/><strong>{t("waitingDevice")}</strong><span>{t("enableUsbDebugging")}</span></div>}
        <div className="device-list">{devices.map((device) => <button key={device.serial} className={`device ${options.serial === device.serial ? "selected" : ""}`} onClick={() => setOption("serial", device.serial)} disabled={device.state !== "device" || mirror.running}>
          <span className="phone-icon"><Smartphone size={20}/></span><span><strong>{device.model ?? device.serial}</strong><small>{device.serial}</small></span><em>{device.state === "device" ? t("connected") : device.state === "unauthorized" ? t("unauthorized") : device.state}</em>
        </button>)}</div>
        <div className="tool-status"><Tool label="ADB" info={environment?.adb} availableLabel={t("available")} unavailableLabel={t("unavailable")}/><Tool label="scrcpy" info={environment?.scrcpy} availableLabel={t("available")} unavailableLabel={t("unavailable")}/></div>
      </section>

      <section className="panel settings-panel">
        <div className="section-title"><div><Settings2 size={18}/><h3>{t("mirrorSettings")}</h3></div><span>{t("recommended")}</span></div>
        <div className="settings-grid">
          <Field label={t("maxResolution")}><select value={options.maxSize} onChange={(e) => setOption("maxSize", Number(e.target.value))} disabled={mirror.running}><option value={1280}>1280p</option><option value={1600}>1600p</option><option value={1920}>1920p</option><option value={2560}>2560p</option></select></Field>
          <Field label={t("maxFps")}><select value={options.maxFps} onChange={(e) => setOption("maxFps", Number(e.target.value))} disabled={mirror.running}><option value={30}>30 FPS</option><option value={60}>60 FPS</option><option value={90}>90 FPS</option><option value={120}>120 FPS</option></select></Field>
          <Field label={t("videoBitrate")}><select value={options.videoBitRateMbps} onChange={(e) => setOption("videoBitRateMbps", Number(e.target.value))} disabled={mirror.running}><option value={4}>4 Mbps</option><option value={8}>8 Mbps</option><option value={12}>12 Mbps</option><option value={20}>20 Mbps</option></select></Field>
        </div>
        <div className="toggles">
          <Toggle label={t("audioForwarding")} checked={options.audio} onChange={(v) => setOption("audio", v)} disabled={mirror.running}/>
          <Toggle label={t("stayAwake")} checked={options.stayAwake} onChange={(v) => setOption("stayAwake", v)} disabled={mirror.running}/>
          <Toggle label={t("startFullscreen")} checked={options.fullscreen} onChange={(v) => setOption("fullscreen", v)} disabled={mirror.running}/>
          <Toggle label={t("alwaysOnTop")} checked={options.alwaysOnTop} onChange={(v) => setOption("alwaysOnTop", v)} disabled={mirror.running}/>
          <Toggle label={t("launchPmp")} checked={options.launchPandaMousePro} onChange={(v) => setOption("launchPandaMousePro", v)} disabled={mirror.running || options.virtualDisplay}/>
          <Toggle label={t("turnScreenOff")} checked={options.turnScreenOff} onChange={(v) => setOption("turnScreenOff", v)} disabled={mirror.running || options.virtualDisplay}/>
        </div>
        <div className="mapping-mode"><Keyboard size={17}/><MousePointer2 size={17}/><div><strong>{t("mappingMode")}</strong><p>{t("mappingDescription")}</p></div><span>{t("enabledByDefault")}</span></div>
        <label className="experimental experimental-toggle"><TriangleAlert size={18}/><div><strong>{t("virtualDisplayUnavailable")}</strong><p>{t("virtualDisplayDescription")}</p></div><span>{t("experimental")}</span><input type="checkbox" checked={options.virtualDisplay} onChange={(event) => setVirtualDisplay(event.target.checked)} disabled={mirror.running}/><i /></label>
      </section>
    </div>

    <section className="panel shortcuts-panel">
      <div className="section-title"><div><Command size={18}/><h3>{t("shortcuts")}</h3></div><span>{t("modDescription")}</span></div>
      <div className="shortcut-grid">
        <Shortcut keys="Command" label={t("releaseMouse")} />
        <Shortcut keys="MOD + F" label={t("toggleFullscreen")} />
        <Shortcut keys="MOD + Q" label={t("quitMirror")} />
        <Shortcut keys="MOD + P" label={t("togglePhoneScreen")} />
        <Shortcut keys="MOD + H" label={t("goHome")} />
        <Shortcut keys="MOD + B" label={t("goBack")} />
        <Shortcut keys="MOD + S" label={t("recentTasks")} />
        <Shortcut keys="MOD + R" label={t("rotateScreen")} />
        <Shortcut keys="MOD + ↑ / ↓" label={t("adjustVolume")} />
        <Shortcut keys="MOD + V" label={t("pasteClipboard")} />
        <Shortcut keys="MOD + K" label={t("keyboardSettings")} />
        <Shortcut keys="MOD + I" label={t("toggleFps")} />
      </div>
      <p className="shortcut-note">{t("shortcutNote")}</p>
    </section>

    <footer><div className="footer-message"><i className={ready ? "ok" : ""}/><span>{message}</span></div><div className="footer-meta"><span>v{packageMetadata.version}</span><button type="button" title={t("officialWebsite")} onClick={() => void openUrl("https://pandagame.app")}>pandagame.app</button></div><div className="footer-actions"><button className="secondary" onClick={() => void activatePmp()} disabled={busy || !canActivatePmp}><Zap size={18}/>{t("activatePmp")}</button><button className={`primary ${mirror.running ? "danger" : ""}`} onClick={() => void toggleMirror()} disabled={busy || (!mirror.running && !ready)}>{mirror.running ? <CircleStop size={19}/> : <MonitorPlay size={19}/>} {mirror.running ? t("stopMirror") : t(options.virtualDisplay ? "startIndependentDisplay" : "startMirror")}</button></div></footer>
  </main>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="field"><span>{label}</span>{children}</label>; }
function Toggle({ label, checked, onChange, disabled }: { label: string; checked: boolean; onChange: (value: boolean) => void; disabled: boolean }) { return <label className="toggle-row"><span>{label}</span><input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} disabled={disabled}/><i /></label>; }
function Tool({ label, info, availableLabel, unavailableLabel }: { label: string; info?: EnvironmentStatus["adb"]; availableLabel: string; unavailableLabel: string }) { return <div><span className={info?.available ? "dot-ok" : "dot-bad"}/><span>{label}</span><small>{info?.available ? info.version ?? availableLabel : unavailableLabel}</small></div>; }
function Shortcut({ keys, label }: { keys: string; label: string }) { return <div className="shortcut"><kbd>{keys}</kbd><span>{label}</span></div>; }
