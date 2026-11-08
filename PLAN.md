# DuckShark - Implementation & Technical Plan

## 1. Overview & Objective

DuckShark is a client-primary audio ducking plugin for [Sharkord](https://sharkord.com) (built on Sharkord Plugin SDK v2). When users are speaking in a voice channel, DuckShark automatically attenuates (ducks) the volume of background audio streams (such as `music-bot` or screen shares) and smoothly restores normal volume when speaking stops.

Crucially, ducking is implemented as a **user-side feature**: each listener configures their own ducking levels and preferences inside **Sharkord User Settings** (`PluginSlot.USER_SETTINGS`), rather than forcing a server-wide setting.

---

## 2. Learnings from GainShark (`Benett53/GainShark`) & `LuckySharkordMusicBot`

1. **Audio Element Identification in Sharkord**:
   - Voice streams: `<audio data-user-id="...">`
   - External plugin streams (e.g. `music-bot`): `<audio data-stream-id="...">`, with React Fiber props containing `pluginId` and `streamKey`.
   - Screen shares: `<audio>` elements placed directly adjacent to `<video>` cards.
2. **Client Plugin Injection**:
   - Server registers UI with `ctx.ui.enable()`.
   - Client bundle exports `components` map keyed by `PluginSlot`.
   - `PluginSlot.USER_SETTINGS` allows rendering custom React settings pages inside Sharkord's native Settings modal.
3. **Global State & Store**:
   - `window.__SHARKORD_STORE__` exposes Sharkord's Redux/Zustand state store.
   - Allows monitoring loaded plugins, active channels, and voice participants.
4. **Web Audio & Playback Integrity**:
   - Sharkord WebRTC tracks decode via `<audio>` elements.
   - When routing through Web Audio `GainNode`, the original `<audio>` element is muted (`el.muted = true`) to prevent double-output, while keeping the element playing so the browser keeps decoding WebRTC packets.

---

## 3. Architecture Design

```
+--------------------------------------------------------------------------------+
|                             SHARKORD CLIENT DOM                                |
|                                                                                |
|  [Voice <audio data-user-id>]              [Stream <audio data-stream-id>]     |
+---------------+-----------------------------------------------+----------------+
                |                                               |
                v                                               v
+---------------+----------------+             +----------------+----------------+
| Voice Activity Detection (VAD) |             |       Ducking Gain Node         |
|  - AnalyserNode per speaker    |             |  - MediaStreamSource            |
|  - Fast RMS level computation  |             |  - GainNode (0.0 to 1.0)        |
|  - Threshold trigger           |             |  - Connected to AudioContext    |
+---------------+----------------+             +----------------+----------------+
                |                                               ^
                | [Speech: ON / OFF]                            |
                v                                               | [Set Gain Target]
+---------------+-----------------------------------------------+----------------+
|                           Duck Controller                                      |
|  - Attack ramp (fade-down: 80ms)                                               |
|  - Hold timer (e.g. 600ms hold after speech ends)                             |
|  - Release ramp (fade-up: 300ms)                                               |
+--------------------------------------------------------------------------------+
                                        ^
                                        | Read & Subscribe
+---------------------------------------+----------------------------------------+
|                          Settings Manager                                      |
|  - localStorage ('duckshark_user_settings')                                   |
|  - UI Component in PluginSlot.USER_SETTINGS                                    |
|  - Enabled, Duck%, Attack, Hold, Release, Targets                              |
+--------------------------------------------------------------------------------+
```

---

## 4. Phase-by-Phase Execution Plan

### Phase 1: Foundation & Build Pipeline
- [x] Scaffolding: `manifest.json`, `package.json`, `tsconfig.json`, `.gitignore`.
- [x] Standalone build script (`build.ts`) targeting Bun with React externals matching Sharkord client globals (`window.__SHARKORD_REACT__`).
- [x] Self-contained SDK references in `./sdk/`.

### Phase 2: Settings Management & User Settings UI
- [x] Create `src/client/constants.ts` with ducking defaults (duck level 25%, hold 600ms, attack 80ms, release 300ms).
- [x] Create `src/client/settings.ts` with `localStorage` persistence, listeners, and `storage` event sync across browser tabs.
- [x] Create `src/client/ui/settings-page.tsx` rendering into `PluginSlot.USER_SETTINGS`:
  - Master toggle (Enable/Disable Ducking)
  - Slider for Ducked Volume Percentage (0% to 80%)
  - Slider for Hold Time (200ms to 1500ms)
  - Checkboxes for what to duck (Music Bot streams, Screen Shares)
  - Microphone self-ducking toggle

### Phase 3: DOM Discovery & Classification
- [x] Observe DOM additions/removals with `MutationObserver`.
- [x] Classify `<audio>` elements:
  - `data-user-id` -> Voice channel participants.
  - `data-stream-id` -> External streams (`music-bot`).
  - Sibling of `<video>` -> Screen shares.

### Phase 4: Voice Activity Detection (VAD)
- [x] Create non-intrusive Web Audio `AnalyserNode` taps on voice streams.
- [x] Calculate RMS signal power every 40ms.
- [x] Retain strong references to `MediaStreamAudioSourceNode` to prevent V8 garbage collection dropouts.
- [x] Fallback/enhancement: Check `window.__SHARKORD_STORE__.getState().voice` for native speaking flags if exposed by Sharkord.
- [x] Tap user's local microphone stream when `duckOnSelfSpeaking` is enabled via `RTCPeerConnection.prototype.addTrack` and `navigator.mediaDevices.getUserMedia`.

### Phase 5: Audio Graph & Ducking Gain Node
- [x] Create Web Audio `GainNode` for stream elements.
- [x] Apply exponential / target smoothing using `gainNode.gain.setTargetAtTime(target, ctx.currentTime, timeConstant)`.
- [x] Preserve native Sharkord volume sliders and mute toggles via element-level property descriptor interception (`el.volume` / `el.muted`).
- [x] Coexistence with GainShark:
  - If GainShark is active and already routing the stream through its boost gain node, detect GainShark's engine (`__gainshark_gain__`) to chain gain nodes without double-routing.
  - Tag stream audio elements with `__duckshark_gain_node__` and `__duckshark_source__`.
- [x] Per-stream target gain tracking so new streams joining mid-speech duck immediately without delay.

### Phase 6: Testing & Packaging
- [x] Build testing with `bun run build`.
- [x] Produce standalone directory bundle (`dist/duckshark/`) and release archive (`dist/duckshark-0.1.0.tar.gz` with `0.1.0.json`).
- [ ] Deploy to Sharkord server `~/.config/sharkord/plugins/duckshark/` (or `SHARKORD_PLUGINS_PATH`).
- [ ] Verify in voice channel with `LuckySharkordMusicBot` playing music while testing speech activity.
- [ ] Verify settings page appears under User Settings and changes take effect immediately.
