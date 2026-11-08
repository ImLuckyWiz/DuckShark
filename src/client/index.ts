import { PluginSlot } from "@sharkord/plugin-sdk";
import type { TPluginComponentsMapBySlotId } from "@sharkord/plugin-sdk/client";
import { PLUGIN_ID } from "./constants";
import { getDuckEngine } from "./engine";
import { SettingsPage } from "./ui/settings-page";

const engine = getDuckEngine();
const store = window.__SHARKORD_STORE__;

const syncEngine = () => {
  if (window.__DUCKSHARK_ENGINE__ !== engine) return;
  if (!store) {
    engine.start();
    return;
  }

  const loaded = store
    .getState()
    ?.plugins?.some?.((plugin: any) => plugin.pluginId === PLUGIN_ID || plugin.id === PLUGIN_ID);

  if (loaded !== false) {
    engine.start();
  } else {
    engine.stop();
  }
};

if (store) {
  store.subscribe(syncEngine);
}
syncEngine();

export const components: TPluginComponentsMapBySlotId = {
  [PluginSlot.USER_SETTINGS]: [SettingsPage],
};
