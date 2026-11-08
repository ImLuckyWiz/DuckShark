# DuckShark 🦆🦈

Audio ducking plugin for [Sharkord](https://sharkord.com) that automatically attenuates (lowers) music bot, stream, and screen share audio when people are talking in voice channels.

Built against **Sharkord Plugin SDK v2**.

---

## ✨ Features

- **Automatic Audio Ducking**: Smoothly attenuates background audio (music bot, streams) whenever voice activity is detected from speaking users.
- **Client-Side User Settings**: Configure your own ducking preferences directly inside Sharkord's **User Settings** (powered by `PluginSlot.USER_SETTINGS`). Settings are kept locally per browser — no server-wide enforcement.
- **Customizable Duck Level**: Set the exact percentage to reduce music volume to (e.g. 25%, 10%, or complete mute).
- **Hold & Release Times**: Configurable hold time (e.g. 600ms) to prevent jarring volume jumps between natural speech pauses, paired with smooth attack/release ramps.
- **Selective Ducking**: Choose whether to duck Music Bot streams, screen shares, or both.
- **Self-Voice Ducking (Optional)**: Can also duck music when *you* speak into your microphone.
- **Works with GainShark**: Designed to operate cleanly alongside volume-boosting plugins and native Sharkord volume sliders.

---

## 🛠️ Architecture & How It Works

1. **Voice Detection (VAD)**:
   - Identifies remote voice streams rendered via `<audio data-user-id="...">`.
   - Taps voice streams with Web Audio `AnalyserNode` to compute real-time RMS signal levels.
   - Detects speech above a sensitivity threshold without altering voice playback.

2. **Ducking Controller**:
   - Detects stream audio elements (such as `music-bot` via `<audio data-stream-id="...">`).
   - Routes the media stream through a Web Audio `GainNode`.
   - When voice activity begins: smoothly lowers gain with an attack ramp (`attackMs`).
   - When all users stop speaking: maintains the ducked state for `holdMs` before smoothly fading back up (`releaseMs`).

3. **User Settings UI**:
   - Renders a clean configuration panel in Sharkord's native User Settings (`PluginSlot.USER_SETTINGS`).
   - Persists settings in `localStorage` with multi-tab synchronisation.

---

## 📦 Installation

1. Copy or extract the `duckshark` folder into your Sharkord plugins directory:
   - Typically `~/.config/sharkord/plugins/duckshark` (or `<data-dir>/plugins/duckshark`).
2. Ensure `duckshark/manifest.json` is located directly at `plugins/duckshark/manifest.json`.
3. In Sharkord:
   - Go to **Server Settings** → **Plugins**.
   - Enable **DuckShark**.
4. Open your **User Settings** in Sharkord to fine-tune your ducking levels and preferences!

---

## 🔨 Development & Building

Built with [Bun](https://bun.sh):

```bash
# Build client and server bundles into dist/duckshark/
bun run build
```

To automatically copy build output into your Sharkord data directory, set `SHARKORD_PLUGINS_PATH` in `.env`:

```env
SHARKORD_PLUGINS_PATH=/path/to/sharkord/apps/server/data/plugins
```
