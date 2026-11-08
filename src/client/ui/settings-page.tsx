import React, { memo, useCallback, useEffect, useState } from "react";
import { DEFAULT_SETTINGS, type TDuckSettings } from "../constants";
import { getDuckEngine, type TEngineStats } from "../engine";
import { getSettings, resetSettings, setSettings, subscribeSettings } from "../settings";

const sectionStyle: React.CSSProperties = {
  display: "grid",
  gap: 12,
  maxWidth: 540,
};

const headingStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 15,
  fontWeight: 600,
};

const hintStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 13,
  color: "var(--muted-foreground, #888)",
  lineHeight: 1.4,
};

const rowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 16,
};

export const SettingsPage = memo(() => {
  const [settings, setLocalSettings] = useState<TDuckSettings>(getSettings);
  const [stats, setStats] = useState<TEngineStats | null>(null);

  useEffect(() => {
    const unsubSettings = subscribeSettings(() => {
      setLocalSettings(getSettings());
    });
    const engine = getDuckEngine();
    const unsubStats = engine.subscribeStats((newStats) => {
      setStats(newStats);
    });

    return () => {
      unsubSettings();
      unsubStats();
    };
  }, []);

  const update = useCallback((partial: Partial<TDuckSettings>) => {
    setSettings(partial);
  }, []);

  return (
    <div style={{ display: "grid", gap: 24, color: "var(--foreground, #eee)", padding: "12px 0" }}>
      <div style={sectionStyle}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <h2 style={{ ...headingStyle, fontSize: 18 }}>DuckShark - Audio Ducking</h2>
          {stats && (
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "3px 10px",
                borderRadius: 12,
                fontSize: 12,
                fontWeight: 600,
                background: stats.isDucking ? "rgba(234, 179, 8, 0.2)" : "rgba(34, 197, 94, 0.15)",
                color: stats.isDucking ? "#eab308" : "#22c55e",
                border: `1px solid ${stats.isDucking ? "rgba(234, 179, 8, 0.4)" : "rgba(34, 197, 94, 0.3)"}`,
              }}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: stats.isDucking ? "#eab308" : "#22c55e",
                  display: "inline-block",
                }}
              />
              {stats.isDucking
                ? `Ducking Active (${settings.duckedVolumePercent}%)`
                : "Idle - Monitoring Voice"}
            </div>
          )}
        </div>
        <p style={hintStyle}>
          Automatically lowers the volume of music bots and streams whenever someone in your voice
          channel speaks, smoothly restoring volume when they finish. Settings are personal to your browser.
        </p>

        {stats && (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 12,
              padding: "8px 12px",
              background: "var(--card, rgba(255, 255, 255, 0.04))",
              borderRadius: 6,
              border: "1px solid var(--border, rgba(255, 255, 255, 0.08))",
              fontSize: 12,
              color: "var(--muted-foreground, #aaa)",
            }}
          >
            <span>
              Voice Participants:{" "}
              <strong style={{ color: "var(--foreground, #eee)" }}>
                {stats.trackedVoicesCount + (stats.isLocalMicActive ? 1 : 0)}
              </strong>
              {stats.isLocalMicActive
                ? stats.trackedVoicesCount > 0
                  ? ` (You + ${stats.trackedVoicesCount} remote)`
                  : " (You · Mic active)"
                : stats.trackedVoicesCount > 0
                  ? " (Remote only)"
                  : ""}
            </span>
            <span>•</span>
            <span>
              Music/Video Streams: <strong style={{ color: "var(--foreground, #eee)" }}>{stats.trackedStreamsCount}</strong>
            </span>
          </div>
        )}
      </div>

      <label style={{ ...sectionStyle, display: "flex", alignItems: "flex-start", gap: 12, cursor: "pointer" }}>
        <input
          type="checkbox"
          checked={settings.enabled}
          onChange={(e) => update({ enabled: e.target.checked })}
          style={{ marginTop: 3, accentColor: "var(--primary, #3b82f6)" }}
        />
        <div style={{ display: "grid", gap: 2 }}>
          <span style={{ fontSize: 14, fontWeight: 500 }}>Enable Audio Ducking</span>
          <span style={hintStyle}>Attenuate background music when speech is detected.</span>
        </div>
      </label>

      {settings.enabled && (
        <>
          <div style={sectionStyle}>
            <div style={rowStyle}>
              <span style={{ fontSize: 14 }}>Ducked Volume Level</span>
              <span style={{ fontSize: 13, fontWeight: 600 }}>{settings.duckedVolumePercent}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={80}
              step={5}
              value={settings.duckedVolumePercent}
              onChange={(e) => update({ duckedVolumePercent: Number(e.target.value) })}
              style={{ accentColor: "var(--primary, #3b82f6)", width: "100%" }}
            />
            <span style={hintStyle}>
              Volume of the music while someone is talking ({settings.duckedVolumePercent}% of normal).
            </span>
          </div>

          <div style={sectionStyle}>
            <div style={rowStyle}>
              <span style={{ fontSize: 14 }}>Hold Time (after speaking stops)</span>
              <span style={{ fontSize: 13, fontWeight: 600 }}>{settings.holdMs} ms</span>
            </div>
            <input
              type="range"
              min={200}
              max={1500}
              step={50}
              value={settings.holdMs}
              onChange={(e) => update({ holdMs: Number(e.target.value) })}
              style={{ accentColor: "var(--primary, #3b82f6)", width: "100%" }}
            />
            <span style={hintStyle}>
              Prevents the music from jumping up and down between brief natural pauses in sentences.
            </span>
          </div>

          <div style={sectionStyle}>
            <div style={rowStyle}>
              <span style={{ fontSize: 14 }}>Attack Time (fade-down speed)</span>
              <span style={{ fontSize: 13, fontWeight: 600 }}>{settings.attackMs} ms</span>
            </div>
            <input
              type="range"
              min={20}
              max={250}
              step={10}
              value={settings.attackMs}
              onChange={(e) => update({ attackMs: Number(e.target.value) })}
              style={{ accentColor: "var(--primary, #3b82f6)", width: "100%" }}
            />
            <span style={hintStyle}>
              How quickly the music fades down when someone begins talking (default 80ms).
            </span>
          </div>

          <div style={sectionStyle}>
            <div style={rowStyle}>
              <span style={{ fontSize: 14 }}>Release Time (fade-back speed)</span>
              <span style={{ fontSize: 13, fontWeight: 600 }}>{settings.releaseMs} ms</span>
            </div>
            <input
              type="range"
              min={100}
              max={800}
              step={25}
              value={settings.releaseMs}
              onChange={(e) => update({ releaseMs: Number(e.target.value) })}
              style={{ accentColor: "var(--primary, #3b82f6)", width: "100%" }}
            />
            <span style={hintStyle}>
              How smoothly the music returns to full volume after the hold time expires (default 300ms).
            </span>
          </div>

          <div style={sectionStyle}>
            <div style={rowStyle}>
              <span style={{ fontSize: 14 }}>Voice Detection Sensitivity</span>
              <span style={{ fontSize: 13, fontWeight: 600 }}>
                {settings.vadThreshold <= 0.01 ? "High (Whispers)" : settings.vadThreshold <= 0.02 ? "Normal" : "Low (Loud Only)"}
              </span>
            </div>
            <input
              type="range"
              min={0.005}
              max={0.04}
              step={0.002}
              value={settings.vadThreshold}
              onChange={(e) => update({ vadThreshold: Number(e.target.value) })}
              style={{ accentColor: "var(--primary, #3b82f6)", width: "100%" }}
            />
            <span style={hintStyle}>
              RMS audio power required to trigger ducking. Lower is more sensitive.
            </span>
          </div>

          <div style={sectionStyle}>
            <h3 style={headingStyle}>Sources to Duck</h3>

            <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={settings.duckMusicStreams}
                onChange={(e) => update({ duckMusicStreams: e.target.checked })}
                style={{ accentColor: "var(--primary, #3b82f6)" }}
              />
              <span style={{ fontSize: 13 }}>Music Bot & External Audio Streams</span>
            </label>

            <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={settings.duckScreenShares}
                onChange={(e) => update({ duckScreenShares: e.target.checked })}
                style={{ accentColor: "var(--primary, #3b82f6)" }}
              />
              <span style={{ fontSize: 13 }}>Screen Share Audio</span>
            </label>

            <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={settings.duckOnSelfSpeaking}
                onChange={(e) => update({ duckOnSelfSpeaking: e.target.checked })}
                style={{ accentColor: "var(--primary, #3b82f6)" }}
              />
              <span style={{ fontSize: 13 }}>Also duck music when I speak into my microphone</span>
            </label>
          </div>

          <div style={{ paddingTop: 8 }}>
            <button
              type="button"
              onClick={resetSettings}
              style={{
                background: "transparent",
                border: "1px solid var(--border, #444)",
                color: "var(--foreground, #eee)",
                borderRadius: 4,
                padding: "6px 12px",
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              Reset to Defaults
            </button>
          </div>
        </>
      )}
    </div>
  );
});
