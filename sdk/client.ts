import { useSyncExternalStore } from "react";
import { PluginCapabilityType, type TPluginContract } from "./index";

declare global {
  interface Window {
    __SHARKORD_STORE__: any;
  }
}

const getStore = () => window.__SHARKORD_STORE__;

const getOwnPluginId = (): string => {
  const match = import.meta.url?.match?.(/\/plugin-bundle\/([^/?#]+)\//);
  if (!match?.[1]) {
    return "music-bot";
  }
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
};

export const createCallAction = <C extends TPluginContract = TPluginContract>() => {
  const pluginId = getOwnPluginId();
  return (name: string, payload?: any) => {
    return getStore().actions.executePluginAction(pluginId, name, payload);
  };
};

export const usePush = <C extends TPluginContract = TPluginContract>(
  handler: (data: any) => void
) => getStore().hooks.usePush(handler);

export const useUserData = <C extends TPluginContract = TPluginContract>() =>
  getStore().hooks.useUserData();

export const useCanUseAction = <C extends TPluginContract = TPluginContract>(
  name: string
) => getStore().hooks.useCanUse(PluginCapabilityType.ACTION, name);

export const useCanUseCommand = <C extends TPluginContract = TPluginContract>(
  name: string
) => getStore().hooks.useCanUse(PluginCapabilityType.COMMAND, name);

export const usePlaybackDeviceId = () => getStore().hooks.usePlaybackDeviceId();

export const useHotkey = (action: any, handler: any) =>
  getStore().hooks.useHotkey(action, handler);

export const useHotkeyBinding = (id: string) =>
  getStore().hooks.useHotkeyBinding(id);

export const useNotify = () => getStore().hooks.useNotify();

export const useNotificationClick = (handler: any) =>
  getStore().hooks.useNotificationClick(handler);

export const useStoreSelector = <T>(selector: (state: any) => T): T =>
  useSyncExternalStore(getStore().subscribe, () => selector(getStore().getState()));
