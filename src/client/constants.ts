export const PLUGIN_ID = "duckshark";
export const STORAGE_KEY = "duckshark_user_settings";

export const DEFAULT_SETTINGS = {
  enabled: true,
  /** Percentage volume when ducked (0 to 100%, default 25%) */
  duckedVolumePercent: 25,
  /** Smooth fade-down duration in milliseconds */
  attackMs: 80,
  /** Hold duration in milliseconds after speech stops before returning */
  holdMs: 600,
  /** Smooth fade-back duration in milliseconds */
  releaseMs: 300,
  /** Whether to duck external music streams (music-bot, etc.) */
  duckMusicStreams: true,
  /** Whether to duck screen shares */
  duckScreenShares: false,
  /** Whether speaking on your own microphone also ducks streams for you */
  duckOnSelfSpeaking: true,
  /** Voice Activity Detection sensitivity threshold (0.005 - 0.05, lower = more sensitive) */
  vadThreshold: 0.015,
};

export type TDuckSettings = typeof DEFAULT_SETTINGS;
