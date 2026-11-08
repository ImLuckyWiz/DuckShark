import { getSettings, subscribeSettings } from "./settings";

/**
 * DuckShark Engine
 *
 * Detects voice activity across connected voice users (and optionally self microphone)
 * and applies smooth gain ducking (attenuation) to music bot and stream audio elements.
 */

type TSourceKind = "voice" | "stream" | "screen";

type TTrackedStream = {
  el: HTMLAudioElement;
  kind: TSourceKind;
  id: string;
  userVolume: number;
  currentDuckedVolume: number;
  animFrame?: number;
  cleanup?: () => void;
};

type TTrackedVoice = {
  el: HTMLAudioElement;
  userId: number;
  sourceNode?: MediaStreamAudioSourceNode;
  analyser?: AnalyserNode;
  dataArray?: Uint8Array;
};

export type TEngineStats = {
  isDucking: boolean;
  isSpeechActive: boolean;
  trackedVoicesCount: number;
  trackedStreamsCount: number;
  isLocalMicActive: boolean;
  activeGainFactor: number;
};

export const createDuckEngine = () => {
  let ctx: AudioContext | undefined;
  let observer: MutationObserver | undefined;
  let vadTimer: ReturnType<typeof setInterval> | undefined;
  let unsubscribeSettings: (() => void) | undefined;

  const trackedVoices = new Map<HTMLAudioElement, TTrackedVoice>();
  const trackedStreams = new Map<HTMLAudioElement, TTrackedStream>();

  let isSpeechActive = false;
  let speechHoldTimeout: ReturnType<typeof setTimeout> | undefined;
  let vadTicks = 0;

  // Track original prototype descriptors for volume/muted
  const realVolumeDesc = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, "volume");
  const realMutedDesc = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, "muted");

  const statsListeners = new Set<(stats: TEngineStats) => void>();

  const getStats = (): TEngineStats => {
    const settings = getSettings();
    const isDucking = settings.enabled && isSpeechActive;
    let isConnectedToVoice = false;
    let isMicMuted = false;

    try {
      const store = (window as any).__SHARKORD_STORE__;
      const state = store?.getState?.();
      isConnectedToVoice = Boolean(state?.currentVoiceChannelId);
      isMicMuted = Boolean(state?.ownVoiceState?.micMuted);
    } catch {}

    return {
      isDucking,
      isSpeechActive,
      trackedVoicesCount: trackedVoices.size,
      trackedStreamsCount: trackedStreams.size,
      isLocalMicActive: Boolean(settings.duckOnSelfSpeaking && isConnectedToVoice && !isMicMuted),
      activeGainFactor: isDucking ? settings.duckedVolumePercent / 100 : 1.0,
    };
  };

  const emitStats = () => {
    const stats = getStats();
    statsListeners.forEach((listener) => {
      try {
        listener(stats);
      } catch (err) {
        console.debug("[DuckShark] Stats listener error:", err);
      }
    });
  };

  const getAudioContext = (): AudioContext => {
    if (!ctx || ctx.state === "closed") {
      ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (ctx.state === "suspended") {
      void ctx.resume().catch(() => {});
    }
    return ctx;
  };

  const resumeOnGesture = () => {
    if (ctx && ctx.state === "suspended") {
      void ctx.resume().catch(() => {});
    }
  };

  /**
   * Classify audio elements in Sharkord DOM:
   * - Voice audio: <audio data-user-id="...">
   * - Stream audio (Music Bot): <audio data-stream-id="..."> or data-stream-key / data-plugin-id
   * - Screen share: <audio> container adjacent to <video>
   */
  const classifyElement = (el: HTMLAudioElement): { kind: TSourceKind; id: string } | undefined => {
    if (el.dataset.userId) {
      return { kind: "voice", id: el.dataset.userId };
    }
    if (el.dataset.streamId || el.dataset.streamKey || el.dataset.pluginId) {
      const id = el.dataset.streamId || el.dataset.streamKey || el.dataset.pluginId || "stream";
      return { kind: "stream", id };
    }
    if (el.closest("[data-stream-id], [data-stream-key], [data-plugin-id]")) {
      return { kind: "stream", id: "stream" };
    }
    if (
      el.dataset.screenShare ||
      el.parentElement?.querySelector("video") ||
      el.closest("div")?.querySelector("video")
    ) {
      return { kind: "screen", id: "screen-share" };
    }
    return undefined;
  };

  const trackElement = (el: HTMLAudioElement) => {
    if (trackedVoices.has(el) || trackedStreams.has(el)) return;

    const classification = classifyElement(el);
    if (!classification) return;

    const stream = (el as any).srcObject as MediaStream | null;
    if (!stream || !stream.getAudioTracks().length) {
      // Stream track not negotiated yet; bind listeners to catch when it starts playing
      const onReady = () => {
        el.removeEventListener("loadedmetadata", onReady);
        el.removeEventListener("play", onReady);
        trackElement(el);
      };
      el.addEventListener("loadedmetadata", onReady, { once: true });
      el.addEventListener("play", onReady, { once: true });
      return;
    }

    if (classification.kind === "voice") {
      try {
        const audioCtx = getAudioContext();
        const sourceNode = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        sourceNode.connect(analyser);
        // Do NOT connect analyser to destination; remote voice already plays natively
        const dataArray = new Uint8Array(analyser.frequencyBinCount);

        trackedVoices.set(el, {
          el,
          userId: Number(classification.id),
          sourceNode,
          analyser,
          dataArray,
        });

        emitStats();
      } catch (err) {
        console.debug("[DuckShark] Failed to attach analyser to voice stream:", err);
      }
    } else {
      // Stream / Screen share (music bot target)
      try {
        // Intercept user's native volume without Web Audio routing
        const initialVolume = typeof el.volume === "number" ? el.volume : 1.0;

        const trackedItem: TTrackedStream = {
          el,
          kind: classification.kind,
          id: classification.id,
          userVolume: initialVolume,
          currentDuckedVolume: initialVolume,
        };

        // Define property getters/setters on this specific element instance
        // so Sharkord UI sliders continue working naturally while DuckShark
        // smoothly animates native hardware volume (no Web Audio resampling/artifacts).
        Object.defineProperty(el, "volume", {
          configurable: true,
          enumerable: true,
          get: () => trackedItem.userVolume,
          set: (val: number) => {
            trackedItem.userVolume = Math.max(0, Math.min(1, Number(val) || 0));
            updateStreamVolume(trackedItem, true);
          },
        });

        // Set initial volume
        updateStreamVolume(trackedItem, true);

        trackedItem.cleanup = () => {
          if (trackedItem.animFrame) {
            cancelAnimationFrame(trackedItem.animFrame);
            trackedItem.animFrame = undefined;
          }
          delete (el as any).volume;
          realVolumeDesc?.set?.call(el, trackedItem.userVolume);
        };

        trackedStreams.set(el, trackedItem);
        emitStats();
      } catch (err) {
        console.debug("[DuckShark] Failed to attach native ducking to stream:", err);
      }
    }
  };

  const untrackElement = (el: HTMLAudioElement) => {
    const voice = trackedVoices.get(el);
    if (voice) {
      try {
        voice.sourceNode?.disconnect();
        voice.analyser?.disconnect();
      } catch {}
      trackedVoices.delete(el);
      emitStats();
    }

    const stream = trackedStreams.get(el);
    if (stream) {
      try {
        stream.cleanup?.();
      } catch {}
      trackedStreams.delete(el);
      emitStats();
    }
  };

  /**
   * Inspects Sharkord DOM speaking indicators.
   *
   * Sharkord's useAudioLevel & useSpeakingState hooks dynamically assign
   * .speaking-effect-low, .speaking-effect-medium, or .speaking-effect-high
   * to voice user cards and sidebar avatars whenever speech is detected
   * (including the local user when unmuted, and remote participants).
   *
   * This non-intrusive DOM inspection delivers instant, zero-CPU speech detection
   * without hijacking or monkey-patching navigator.mediaDevices.getUserMedia.
   */
  const checkSpeaking = (): boolean => {
    const settings = getSettings();
    const store = (window as any).__SHARKORD_STORE__;
    const state = store && typeof store.getState === "function" ? store.getState() : undefined;

    const inVoice = Boolean(state?.currentVoiceChannelId);
    const micMuted = Boolean(state?.ownVoiceState?.micMuted);

    // Only evaluate voice activity if connected to a voice channel
    if (inVoice) {
      const speakingEl = document.querySelector(
        ".speaking-effect-low, .speaking-effect-medium, .speaking-effect-high, [class*='speaking-effect-']"
      );

      if (speakingEl) {
        // If duckOnSelfSpeaking is enabled and user is not muted, duck!
        if (settings.duckOnSelfSpeaking && !micMuted) {
          return true;
        }

        // If duckOnSelfSpeaking is disabled, only duck if remote participants are speaking
        if (!settings.duckOnSelfSpeaking && trackedVoices.size > 0) {
          return true;
        }
      }
    }

    return false;
  };

  /**
   * Voice Activity Detection loop:
   * Inspects all active voice streams to check if someone is speaking.
   */
  const checkVAD = () => {
    const settings = getSettings();
    if (!settings.enabled) {
      if (isSpeechActive) setSpeechActive(false);
      return;
    }

    vadTicks++;
    // Periodically re-scan DOM for any newly negotiated media tracks (every ~1s)
    if (vadTicks % 25 === 0) {
      scan();
    }

    let speakingNow = false;

    // 1. Sharkord DOM indicator check (handles local user + remote users)
    if (checkSpeaking()) {
      speakingNow = true;
    }

    // 2. Web Audio RMS check across remote voice participants
    if (!speakingNow) {
      for (const [el, voice] of trackedVoices.entries()) {
        if (!document.body.contains(el)) {
          untrackElement(el);
          continue;
        }
        if (!voice.analyser || !voice.dataArray) continue;

        voice.analyser.getByteTimeDomainData(voice.dataArray);
        let sum = 0;
        for (let i = 0; i < voice.dataArray.length; i++) {
          const val = (voice.dataArray[i]! - 128) / 128;
          sum += val * val;
        }
        const rms = Math.sqrt(sum / voice.dataArray.length);

        if (rms > settings.vadThreshold) {
          speakingNow = true;
          break;
        }
      }
    }

    // Speech hold state machine
    if (speakingNow) {
      if (speechHoldTimeout) {
        clearTimeout(speechHoldTimeout);
        speechHoldTimeout = undefined;
      }
      if (!isSpeechActive) {
        setSpeechActive(true);
      }
    } else if (isSpeechActive && !speechHoldTimeout) {
      speechHoldTimeout = setTimeout(() => {
        setSpeechActive(false);
        speechHoldTimeout = undefined;
      }, settings.holdMs);
    }
  };

  const setSpeechActive = (active: boolean) => {
    if (isSpeechActive === active) return;
    isSpeechActive = active;
    console.log(`[DuckShark] Voice activity ${active ? "detected (ducking audio)" : "ended (restoring audio)"}`);
    applyDucking();
    emitStats();
  };

  const updateStreamVolume = (item: TTrackedStream, immediate: boolean = false) => {
    const settings = getSettings();
    const shouldDuck =
      (item.kind === "stream" && settings.duckMusicStreams) ||
      (item.kind === "screen" && settings.duckScreenShares);

    const duckFactor = settings.enabled && isSpeechActive && shouldDuck
      ? Math.max(0, Math.min(1, settings.duckedVolumePercent / 100))
      : 1.0;

    const targetVolume = item.userVolume * duckFactor;

    if (item.animFrame) {
      cancelAnimationFrame(item.animFrame);
      item.animFrame = undefined;
    }

    if (immediate) {
      item.currentDuckedVolume = targetVolume;
      realVolumeDesc?.set?.call(item.el, targetVolume);
      return;
    }

    const startVolume = item.currentDuckedVolume;
    const startTime = performance.now();
    const duration = isSpeechActive ? settings.attackMs : settings.releaseMs;

    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, Math.max(0, elapsed / Math.max(1, duration)));
      // Cosine easing for smooth, broadcast-grade crossfade without clicks
      const ease = 0.5 - 0.5 * Math.cos(progress * Math.PI);
      const current = startVolume + (targetVolume - startVolume) * ease;

      item.currentDuckedVolume = current;
      realVolumeDesc?.set?.call(item.el, current);

      if (progress < 1) {
        item.animFrame = requestAnimationFrame(step);
      } else {
        item.animFrame = undefined;
      }
    };

    item.animFrame = requestAnimationFrame(step);
  };

  const applyDucking = (immediate: boolean = false) => {
    for (const [el, item] of trackedStreams.entries()) {
      if (!document.body.contains(el)) {
        untrackElement(el);
        continue;
      }
      updateStreamVolume(item, immediate);
    }
  };

  const scan = () => {
    const audioElements = document.querySelectorAll<HTMLAudioElement>("audio");
    audioElements.forEach(trackElement);
  };

  const start = () => {
    window.addEventListener("pointerdown", resumeOnGesture, true);
    window.addEventListener("keydown", resumeOnGesture, true);

    observer = new MutationObserver(() => scan());
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-user-id", "data-stream-id", "data-stream-key", "data-plugin-id", "src"],
    });

    vadTimer = setInterval(checkVAD, 40); // 25fps audio check
    unsubscribeSettings = subscribeSettings(() => {
      applyDucking(false);
      emitStats();
    });

    scan();
    emitStats();
    console.log("[DuckShark] Ducking engine started");
  };

  const stop = () => {
    window.removeEventListener("pointerdown", resumeOnGesture, true);
    window.removeEventListener("keydown", resumeOnGesture, true);

    observer?.disconnect();
    observer = undefined;

    if (vadTimer) clearInterval(vadTimer);
    vadTimer = undefined;

    if (speechHoldTimeout) clearTimeout(speechHoldTimeout);
    speechHoldTimeout = undefined;

    unsubscribeSettings?.();
    unsubscribeSettings = undefined;

    for (const voice of trackedVoices.values()) {
      try {
        voice.sourceNode?.disconnect();
        voice.analyser?.disconnect();
      } catch {}
    }
    trackedVoices.clear();

    for (const el of Array.from(trackedStreams.keys())) {
      untrackElement(el);
    }
    trackedStreams.clear();

    void ctx?.close().catch(() => {});
    ctx = undefined;

    emitStats();
    console.log("[DuckShark] Ducking engine stopped");
  };

  return {
    start,
    stop,
    getIsDucking: () => isSpeechActive && getSettings().enabled,
    getStats,
    subscribeStats: (listener: (stats: TEngineStats) => void) => {
      statsListeners.add(listener);
      listener(getStats());
      return () => statsListeners.delete(listener);
    },
    scan,
  };
};

export type TDuckEngine = ReturnType<typeof createDuckEngine>;

declare global {
  interface Window {
    __DUCKSHARK_ENGINE__?: TDuckEngine;
  }
}

export const getDuckEngine = (): TDuckEngine => {
  const previous = window.__DUCKSHARK_ENGINE__;
  if (previous && previous !== engine) {
    previous.stop();
  }
  window.__DUCKSHARK_ENGINE__ = engine;
  return engine;
};

const engine = createDuckEngine();
