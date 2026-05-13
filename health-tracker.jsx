import { useState, useEffect } from "react";

const STORAGE_KEYS = {
  logs: "health-tracker-logs-v2",
  reminders: "health-tracker-reminders-v1",
};

const DEFAULT_LOGS = { insulin: [], glucose: [], teeth: [] };
const DEFAULT_REMINDERS = {
  insulin: { time: "08:00", enabled: false },
  glucose: { time: "07:00", enabled: false },
  teeth: { time: "21:00", enabled: false },
};

function playAlarm(type = "alarm") {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const beeps = type === "alarm" ? 6 : 2;
    for (let i = 0; i < beeps; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "square";
      osc.frequency.setValueAtTime(type === "alarm" ? 880 : 660, ctx.currentTime + i * 0.35);
      osc.frequency.setValueAtTime(type === "alarm" ? 660 : 880, ctx.currentTime + i * 0.35 + 0.15);
      gain.gain.setValueAtTime(type === "alarm" ? 0.65 : 0.35, ctx.currentTime + i * 0.35);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.35 + 0.3);
      osc.start(ctx.currentTime + i * 0.35);
      osc.stop(ctx.currentTime + i * 0.35 + 0.3);
    }
  } catch (e) {}
}

function todayStr() { return new Date().toDateString(); }
function fmtTime(iso) { return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); }
function fmtDate(iso) { return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric" }); }

function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  d.setHours(0, 0, 0, 0);
  return d;
}
function weekLabel(ws) {
  const end = new Date(ws);
  end.setDate(end.getDate() + 6);
  return `${ws.toLocaleDateString([], { month: "short", day: "numeric" })}–${end.toLocaleDateString([], { day: "numeric" })}`;
}

const TRACKERS = [
  { id: "insulin", label: "Insulin", icon: "💉", color: "#3B82F6", colorLight: "#EFF6FF", colorBorder: "#BFDBFE" },
  { id: "glucose", label: "Blood Glucose", icon: "🩸", color: "#EF4444", colorLight: "#FEF2F2", colorBorder: "#FECACA" },
  { id: "teeth", label: "Brushing Teeth", icon: "🦷", color: "#10B981", colorLight: "#ECFDF5", colorBorder: "#A7F3D0" },
];

function InsulinCard({ logs, onLog, isPartner }) {
  const t = TRACKERS[0];
  const todayLogs = logs.filter(l => new Date(l.ts).toDateString() === todayStr());
  const takenToday = todayLogs.length > 0;
  return (
    <div style={{ background: "var(--color-background-primary)", border: `1.5px solid ${t.colorBorder}`, borderRadius: 16, overflow: "hidden", marginBottom: 16 }}>
      <div style={{ background: t.colorLight, padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `1px solid ${t.colorBorder}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 26 }}>{t.icon}</span>
          <div>
            <div style={{ fontWeight: 600, fontSize: 15, color: "var(--color-text-primary)" }}>{t.label}</div>
            <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
              {takenToday ? `✓ Taken today at ${fmtTime(todayLogs[todayLogs.length - 1].ts)}` : "Not logged today"}
            </div>
          </div>
        </div>
        {!isPartner && (
          <button onClick={() => { onLog("insulin", { ts: new Date().toISOString() }); playAlarm("confirm"); }}
            style={{ background: takenToday ? "#D1FAE5" : t.color, color: takenToday ? "#065F46" : "#fff", border: takenToday ? "1px solid #A7F3D0" : "none", borderRadius: 10, padding: "8px 14px", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
            {takenToday ? "✓ Log again" : "✓ Mark taken"}
          </button>
        )}
      </div>
      <div style={{ padding: "10px 18px", maxHeight: 130, overflowY: "auto" }}>
        {logs.length === 0
          ? <div style={{ color: "var(--color-text-tertiary)", fontSize: 13, textAlign: "center", padding: "8px 0" }}>No entries yet</div>
          : [...logs].reverse().slice(0, 6).map((l, i, arr) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: i < arr.length - 1 ? "0.5px solid var(--color-border-tertiary)" : "none" }}>
                <span style={{ fontSize: 13, color: t.color, fontWeight: 600 }}>✓ Taken</span>
                <span style={{ fontSize: 11, color: "var(--color-text-tertiary)" }}>{fmtDate(l.ts)} {fmtTime(l.ts)}</span>
              </div>
            ))
        }
      </div>
    </div>
  );
}

function GlucoseCard({ logs, onLog, isPartner }) {
  const t = TRACKERS[1];
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [note, setNote] = useState("");
  const todayLogs = logs.filter(l => new Date(l.ts).toDateString() === todayStr());
  const last = logs.length > 0 ? logs[logs.length - 1] : null;
  const lvl = last ? Number(last.value) : null;
  const statusColor = lvl ? (lvl < 70 ? "#EF4444" : lvl > 180 ? "#F59E0B" : "#10B981") : t.color;
  const statusLabel = lvl ? (lvl < 70 ? "Low" : lvl > 180 ? "High" : "Normal") : null;

  function submit() {
    if (!value) return;
    onLog("glucose", { ts: new Date().toISOString(), value, note });
    setValue(""); setNote(""); setOpen(false);
    playAlarm("confirm");
  }

  return (
    <div style={{ background: "var(--color-background-primary)", border: `1.5px solid ${t.colorBorder}`, borderRadius: 16, overflow: "hidden", marginBottom: 16 }}>
      <div style={{ background: t.colorLight, padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `1px solid ${t.colorBorder}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 26 }}>{t.icon}</span>
          <div>
            <div style={{ fontWeight: 600, fontSize: 15, color: "var(--color-text-primary)" }}>{t.label}</div>
            <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
              {todayLogs.length} reading{todayLogs.length !== 1 ? "s" : ""} today
              {last && <span style={{ marginLeft: 6, color: statusColor, fontWeight: 600 }}>{last.value} mg/dL{statusLabel ? ` · ${statusLabel}` : ""}</span>}
            </div>
          </div>
        </div>
        {!isPartner && (
          <button onClick={() => setOpen(v => !v)} style={{ background: t.color, color: "#fff", border: "none", borderRadius: 10, padding: "8px 14px", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
            {open ? "Cancel" : "+ Log"}
          </button>
        )}
      </div>
      {open && !isPartner && (
        <div style={{ padding: "14px 18px", borderBottom: `1px solid ${t.colorBorder}`, background: "var(--color-background-secondary)" }}>
          <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 12, color: "var(--color-text-secondary)", display: "block", marginBottom: 4 }}>Level (mg/dL)</label>
              <input type="number" placeholder="e.g. 120" value={value} onChange={e => setValue(e.target.value)}
                style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--color-border-secondary)", fontSize: 14, background: "var(--color-background-primary)", color: "var(--color-text-primary)", boxSizing: "border-box" }} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 12, color: "var(--color-text-secondary)", display: "block", marginBottom: 4 }}>Notes (optional)</label>
              <input type="text" placeholder="e.g. fasting" value={note} onChange={e => setNote(e.target.value)}
                style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--color-border-secondary)", fontSize: 14, background: "var(--color-background-primary)", color: "var(--color-text-primary)", boxSizing: "border-box" }} />
            </div>
          </div>
          <button onClick={submit} style={{ background: t.color, color: "#fff", border: "none", borderRadius: 8, padding: "9px 20px", fontWeight: 600, fontSize: 13, cursor: "pointer", width: "100%" }}>Save reading</button>
        </div>
      )}
      <div style={{ padding: "10px 18px", maxHeight: 140, overflowY: "auto" }}>
        {logs.length === 0
          ? <div style={{ color: "var(--color-text-tertiary)", fontSize: 13, textAlign: "center", padding: "8px 0" }}>No readings yet</div>
          : [...logs].reverse().slice(0, 8).map((l, i, arr) => {
              const v = Number(l.value);
              const c = v < 70 ? "#EF4444" : v > 180 ? "#F59E0B" : "#10B981";
              const lb = v < 70 ? "Low" : v > 180 ? "High" : "Normal";
              return (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 0", borderBottom: i < arr.length - 1 ? "0.5px solid var(--color-border-tertiary)" : "none" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ background: c + "22", color: c, fontWeight: 700, fontSize: 13, padding: "2px 10px", borderRadius: 20, border: `1px solid ${c}44` }}>{l.value} mg/dL</span>
                    <span style={{ fontSize: 11, color: c }}>{lb}</span>
                    {l.note && <span style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>{l.note}</span>}
                  </div>
                  <span style={{ fontSize: 11, color: "var(--color-text-tertiary)" }}>{fmtDate(l.ts)} {fmtTime(l.ts)}</span>
                </div>
              );
            })
        }
      </div>
    </div>
  );
}

function TeethCard({ logs, onLog, isPartner }) {
  const t = TRACKERS[2];
  const todayLogs = logs.filter(l => new Date(l.ts).toDateString() === todayStr());
  const count = todayLogs.length;
  return (
    <div style={{ background: "var(--color-background-primary)", border: `1.5px solid ${t.colorBorder}`, borderRadius: 16, overflow: "hidden", marginBottom: 16 }}>
      <div style={{ background: t.colorLight, padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `1px solid ${t.colorBorder}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 26 }}>{t.icon}</span>
          <div>
            <div style={{ fontWeight: 600, fontSize: 15, color: "var(--color-text-primary)" }}>{t.label}</div>
            <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
              <span style={{ fontWeight: 700, color: t.color, fontSize: 14 }}>{count}</span> time{count !== 1 ? "s" : ""} today
            </div>
          </div>
        </div>
        {!isPartner && (
          <button onClick={() => { onLog("teeth", { ts: new Date().toISOString() }); playAlarm("confirm"); }}
            style={{ background: t.color, color: "#fff", border: "none", borderRadius: 10, padding: "8px 14px", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
            + Log brush
          </button>
        )}
      </div>
      <div style={{ padding: "10px 18px 12px", display: "flex", gap: 6, flexWrap: "wrap", minHeight: 44, alignItems: "center" }}>
        {count === 0
          ? <span style={{ color: "var(--color-text-tertiary)", fontSize: 13 }}>No brushes logged today</span>
          : todayLogs.map((l, i) => (
              <span key={i} style={{ background: t.colorLight, border: `1px solid ${t.colorBorder}`, color: t.color, fontWeight: 600, fontSize: 12, padding: "3px 10px", borderRadius: 20 }}>
                #{i + 1} · {fmtTime(l.ts)}
              </span>
            ))
        }
      </div>
    </div>
  );
}

function WeeklyView({ logs }) {
  const now = new Date();
  const weeks = [];
  for (let w = 3; w >= 0; w--) {
    const d = new Date(now);
    d.setDate(d.getDate() - w * 7);
    const ws = getWeekStart(d);
    const we = new Date(ws); we.setDate(we.getDate() + 7);
    weeks.push({ start: ws, end: we, label: weekLabel(ws) });
  }

  const weekData = weeks.map(({ start, end }) => {
    const inRange = ts => { const d = new Date(ts); return d >= start && d < end; };
    return {
      insulin: (logs.insulin || []).filter(l => inRange(l.ts)).length,
      glucose: (logs.glucose || []).filter(l => inRange(l.ts)).length,
      teeth: (logs.teeth || []).filter(l => inRange(l.ts)).length,
    };
  });

  const rows = [
    { id: "insulin", label: "Insulin taken", icon: "💉", color: "#3B82F6", bg: "#EFF6FF", border: "#BFDBFE" },
    { id: "glucose", label: "Glucose readings", icon: "🩸", color: "#EF4444", bg: "#FEF2F2", border: "#FECACA" },
    { id: "teeth", label: "Brushing sessions", icon: "🦷", color: "#10B981", bg: "#ECFDF5", border: "#A7F3D0" },
  ];

  const maxVals = rows.reduce((acc, r) => {
    acc[r.id] = Math.max(...weekData.map(d => d[r.id]), 1);
    return acc;
  }, {});

  return (
    <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 16, padding: "16px 18px", marginBottom: 16 }}>
      <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 16, color: "var(--color-text-primary)", display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 18 }}>📅</span> Weekly overview — last 4 weeks
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 360 }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", fontSize: 11, color: "var(--color-text-tertiary)", fontWeight: 500, paddingBottom: 10, paddingRight: 12 }}>Habit</th>
              {weeks.map((w, i) => (
                <th key={i} style={{ fontSize: 11, color: i === 3 ? "var(--color-text-primary)" : "var(--color-text-tertiary)", fontWeight: i === 3 ? 600 : 500, paddingBottom: 10, textAlign: "center", whiteSpace: "nowrap" }}>
                  {i === 3 ? "This week" : w.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.id}>
                <td style={{ paddingRight: 12, paddingBottom: 14, paddingTop: 4 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 15 }}>{row.icon}</span>
                    <span style={{ fontSize: 12, fontWeight: 500, color: "var(--color-text-secondary)", whiteSpace: "nowrap" }}>{row.label}</span>
                  </div>
                </td>
                {weekData.map((wd, wi) => {
                  const count = wd[row.id];
                  const pct = count / maxVals[row.id];
                  const isCurrent = wi === 3;
                  return (
                    <td key={wi} style={{ textAlign: "center", paddingBottom: 14, paddingTop: 4, paddingLeft: 4, paddingRight: 4 }}>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                        <div style={{ width: 32, height: 52, background: "var(--color-background-secondary)", borderRadius: 6, display: "flex", alignItems: "flex-end", overflow: "hidden", border: isCurrent ? `1px solid ${row.border}` : "0.5px solid var(--color-border-tertiary)" }}>
                          <div style={{ width: "100%", height: `${Math.max(pct * 100, count > 0 ? 8 : 0)}%`, background: count > 0 ? (isCurrent ? row.color : row.color + "77") : "transparent", borderRadius: "4px 4px 0 0" }} />
                        </div>
                        <span style={{ fontSize: 13, fontWeight: isCurrent ? 700 : 500, color: count > 0 ? (isCurrent ? row.color : "var(--color-text-secondary)") : "var(--color-text-tertiary)" }}>{count}</span>
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ borderTop: "0.5px solid var(--color-border-tertiary)", marginTop: 4, paddingTop: 10, display: "flex", gap: 16, flexWrap: "wrap" }}>
        {rows.map(row => {
          const curr = weekData[3][row.id];
          const prev = weekData[2][row.id];
          const diff = curr - prev;
          return (
            <div key={row.id} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 13 }}>{row.icon}</span>
              <span style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
                {curr} this week
                {prev > 0 && <span style={{ marginLeft: 4, color: diff >= 0 ? "#10B981" : "#EF4444", fontWeight: 600 }}>{diff >= 0 ? `▲${diff}` : `▼${Math.abs(diff)}`} vs last</span>}
                {prev === 0 && curr > 0 && <span style={{ marginLeft: 4, color: "#10B981", fontWeight: 600 }}>↑ new</span>}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ReminderPanel({ reminders, onChange, isPartner }) {
  return (
    <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 16, padding: "16px 18px", marginBottom: 16 }}>
      <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 12, color: "var(--color-text-primary)", display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 18 }}>🔔</span> Daily reminders
      </div>
      {TRACKERS.map(t => (
        <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0", borderBottom: "0.5px solid var(--color-border-tertiary)" }}>
          <span style={{ fontSize: 18, width: 24 }}>{t.icon}</span>
          <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: "var(--color-text-primary)" }}>{t.label}</span>
          <input type="time" value={reminders[t.id]?.time || "08:00"} disabled={isPartner}
            onChange={e => !isPartner && onChange(t.id, "time", e.target.value)}
            style={{ padding: "5px 8px", borderRadius: 8, border: "1px solid var(--color-border-secondary)", fontSize: 13, background: "var(--color-background-secondary)", color: "var(--color-text-primary)", cursor: isPartner ? "not-allowed" : "auto" }} />
          <div onClick={() => !isPartner && onChange(t.id, "enabled", !reminders[t.id]?.enabled)}
            style={{ width: 36, height: 20, borderRadius: 10, background: reminders[t.id]?.enabled ? t.color : "var(--color-border-secondary)", position: "relative", cursor: isPartner ? "not-allowed" : "pointer", transition: "background 0.2s", flexShrink: 0 }}>
            <div style={{ position: "absolute", top: 2, left: reminders[t.id]?.enabled ? 18 : 2, width: 16, height: 16, borderRadius: "50%", background: "#fff", transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
          </div>
          <span style={{ fontSize: 11, color: "var(--color-text-secondary)", width: 22 }}>{reminders[t.id]?.enabled ? "On" : "Off"}</span>
        </div>
      ))}
      {!isPartner && <div style={{ fontSize: 11, color: "var(--color-text-tertiary)", marginTop: 10 }}>Keep this tab open for reminders to fire.</div>}
    </div>
  );
}

function AlarmModal({ tracker, onDismiss }) {
  useEffect(() => {
    playAlarm("alarm");
    const iv = setInterval(() => playAlarm("alarm"), 3000);
    return () => clearInterval(iv);
  }, []);
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }}>
      <div style={{ background: "var(--color-background-primary)", borderRadius: 20, padding: "32px 28px", maxWidth: 300, width: "90%", textAlign: "center", border: `3px solid ${tracker.color}` }}>
        <div style={{ fontSize: 56, marginBottom: 10 }}>{tracker.icon}</div>
        <div style={{ fontWeight: 700, fontSize: 20, marginBottom: 6, color: "var(--color-text-primary)" }}>Reminder!</div>
        <div style={{ fontSize: 14, color: "var(--color-text-secondary)", marginBottom: 24 }}>Time to log your <strong>{tracker.label}</strong></div>
        <button onClick={onDismiss} style={{ background: tracker.color, color: "#fff", border: "none", borderRadius: 12, padding: "12px 0", fontWeight: 700, fontSize: 15, cursor: "pointer", width: "100%" }}>
          Got it — dismiss
        </button>
      </div>
    </div>
  );
}

export default function App() {
  const [logs, setLogs] = useState(DEFAULT_LOGS);
  const [reminders, setReminders] = useState(DEFAULT_REMINDERS);
  const [loaded, setLoaded] = useState(false);
  const [isPartner, setIsPartner] = useState(false);
  const [activeAlarm, setActiveAlarm] = useState(null);
  const [lastFired, setLastFired] = useState({});
  const [saving, setSaving] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [tab, setTab] = useState("today");

  async function loadData() {
    try {
      const [lr, rr] = await Promise.all([
        window.storage.get(STORAGE_KEYS.logs, true),
        window.storage.get(STORAGE_KEYS.reminders, true),
      ]);
      if (lr?.value) setLogs(JSON.parse(lr.value));
      if (rr?.value) setReminders(JSON.parse(rr.value));
      setLastRefresh(new Date().toLocaleTimeString());
    } catch (e) {}
    setLoaded(true);
  }

  useEffect(() => { loadData(); }, []);

  async function saveData(nl, nr) {
    setSaving(true);
    try {
      await Promise.all([
        window.storage.set(STORAGE_KEYS.logs, JSON.stringify(nl), true),
        window.storage.set(STORAGE_KEYS.reminders, JSON.stringify(nr), true),
      ]);
    } catch (e) {}
    setSaving(false);
  }

  function handleLog(trackerId, entry) {
    const nl = { ...logs, [trackerId]: [...(logs[trackerId] || []), entry] };
    setLogs(nl);
    saveData(nl, reminders);
  }

  function handleReminderChange(id, field, val) {
    const nr = { ...reminders, [id]: { ...reminders[id], [field]: val } };
    setReminders(nr);
    saveData(logs, nr);
  }

  useEffect(() => {
    const check = () => {
      const now = new Date();
      const hhmm = `${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`;
      TRACKERS.forEach(t => {
        const rem = reminders[t.id];
        if (rem?.enabled && rem.time === hhmm) {
          const key = `${t.id}-${hhmm}-${now.toDateString()}`;
          if (!lastFired[key]) {
            setLastFired(p => ({ ...p, [key]: true }));
            setActiveAlarm(t);
          }
        }
      });
    };
    const iv = setInterval(check, 15000);
    check();
    return () => clearInterval(iv);
  }, [reminders, lastFired]);

  useEffect(() => {
    if (!isPartner) return;
    const iv = setInterval(loadData, 30000);
    return () => clearInterval(iv);
  }, [isPartner]);

  if (!loaded) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 200, color: "var(--color-text-secondary)", fontSize: 14 }}>Loading…</div>
  );

  const todayCounts = {
    insulin: (logs.insulin || []).filter(l => new Date(l.ts).toDateString() === todayStr()).length,
    glucose: (logs.glucose || []).filter(l => new Date(l.ts).toDateString() === todayStr()).length,
    teeth: (logs.teeth || []).filter(l => new Date(l.ts).toDateString() === todayStr()).length,
  };

  return (
    <div style={{ maxWidth: 560, margin: "0 auto", padding: "16px 16px 40px", fontFamily: "var(--font-sans)" }}>
      <h2 className="sr-only">Health Tracker — insulin, blood glucose, and teeth brushing</h2>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 20, color: "var(--color-text-primary)", letterSpacing: "-0.3px" }}>Health Tracker</div>
          <div style={{ fontSize: 12, color: "var(--color-text-tertiary)", marginTop: 2 }}>
            {new Date().toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })}
            {saving && " · Saving…"}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>{isPartner ? "Partner" : "My view"}</span>
          <div onClick={() => { setIsPartner(v => !v); if (!isPartner) loadData(); }}
            style={{ width: 44, height: 24, borderRadius: 12, background: isPartner ? "#8B5CF6" : "var(--color-border-secondary)", position: "relative", cursor: "pointer", transition: "background 0.2s" }}>
            <div style={{ position: "absolute", top: 3, left: isPartner ? 22 : 3, width: 18, height: 18, borderRadius: "50%", background: "#fff", transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
          </div>
        </div>
      </div>

      {isPartner && (
        <div style={{ background: "#F5F3FF", border: "1px solid #DDD6FE", borderRadius: 12, padding: "10px 14px", marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: 13, color: "#5B21B6", fontWeight: 500 }}>👥 Partner view — read only</div>
          <button onClick={loadData} style={{ fontSize: 12, color: "#7C3AED", background: "none", border: "1px solid #C4B5FD", borderRadius: 8, padding: "4px 10px", cursor: "pointer" }}>Refresh</button>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 18 }}>
        {TRACKERS.map(t => (
          <div key={t.id} style={{ background: t.colorLight, border: `1px solid ${t.colorBorder}`, borderRadius: 12, padding: "12px 10px", textAlign: "center" }}>
            <div style={{ fontSize: 22, marginBottom: 4 }}>{t.icon}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: t.color }}>{todayCounts[t.id]}</div>
            <div style={{ fontSize: 11, color: "var(--color-text-secondary)", marginTop: 2 }}>today</div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
        {["today", "weekly", "reminders"].map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{ flex: 1, padding: "9px 4px", borderRadius: 10, border: tab === t ? "none" : "0.5px solid var(--color-border-secondary)", background: tab === t ? "var(--color-text-primary)" : "var(--color-background-secondary)", color: tab === t ? "var(--color-background-primary)" : "var(--color-text-secondary)", fontWeight: tab === t ? 600 : 400, fontSize: 13, cursor: "pointer" }}>
            {t === "today" ? "Today" : t === "weekly" ? "Weekly" : "Reminders"}
          </button>
        ))}
      </div>

      {tab === "today" && <>
        <InsulinCard logs={logs.insulin || []} onLog={handleLog} isPartner={isPartner} />
        <GlucoseCard logs={logs.glucose || []} onLog={handleLog} isPartner={isPartner} />
        <TeethCard logs={logs.teeth || []} onLog={handleLog} isPartner={isPartner} />
      </>}

      {tab === "weekly" && <WeeklyView logs={logs} />}
      {tab === "reminders" && <ReminderPanel reminders={reminders} onChange={handleReminderChange} isPartner={isPartner} />}

      <div style={{ background: "var(--color-background-secondary)", borderRadius: 12, padding: "12px 16px", border: "0.5px solid var(--color-border-tertiary)", marginTop: 4 }}>
        <div style={{ fontWeight: 600, fontSize: 13, color: "var(--color-text-primary)", marginBottom: 6 }}>🔗 Share with your partner</div>
        <div style={{ fontSize: 12, color: "var(--color-text-secondary)", lineHeight: 1.6 }}>
          Share this artifact link. Your partner opens it, flips to <strong>Partner view</strong>, and sees all logs live. No account needed.
        </div>
        {lastRefresh && <div style={{ fontSize: 11, color: "var(--color-text-tertiary)", marginTop: 6 }}>Last synced: {lastRefresh}</div>}
      </div>

      {activeAlarm && <AlarmModal tracker={activeAlarm} onDismiss={() => setActiveAlarm(null)} />}
    </div>
  );
}
