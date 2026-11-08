# Antigravity Starter Prompt for DuckShark Project

Copy and paste the prompt below when starting your new Antigravity session in the `DuckShark` workspace folder (`d:\Lucky\Coding\DuckShark`):

```markdown
I am working on DuckShark, a Sharkord plugin (built for Sharkord Plugin SDK v2) that automatically ducks (lowers) music bot and stream audio whenever someone in the voice channel is speaking.

The project is already scaffolded in this directory:
- `manifest.json`: Plugin ID `duckshark`, SDK v2
- `sdk/`: Local Sharkord Plugin SDK v2 definitions (`client.ts`, `index.ts`)
- `build.ts`: Bun build script that compiles client and server bundles with Sharkord React globals mapping
- `src/server/index.ts`: Server plugin loader (`ctx.ui.enable()`)
- `src/client/`:
  - `index.ts`: Registers `PluginSlot.USER_SETTINGS` and controls engine lifecycle
  - `constants.ts`: Default ducking parameters (duck percent, attack, hold, release)
  - `settings.ts`: LocalStorage persistence and subscriber hooks
  - `ui/settings-page.tsx`: React settings page inside Sharkord's User Settings
  - `engine.ts`: Core ducking engine with DOM mutation observer, Web Audio VAD (Voice Activity Detection), and GainNode ducking attenuation

Key reference implementations:
1. `LuckySharkordMusicBot` (`d:\Lucky\Coding\LuckySharkordMusicBot`): Sharkord music bot streaming audio via WebRTC and external streams.
2. `GainShark` (`https://github.com/Benett53/GainShark`): Sharkord volume booster plugin that intercepts `<audio>` elements, patches volume descriptors, and routes through Web Audio.

Please review `PLAN.md` and `README.md`, check the implementation in `src/client/engine.ts`, and help me complete, verify, and build the plugin.
```
