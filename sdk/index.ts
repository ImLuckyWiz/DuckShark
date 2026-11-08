import type React from "react";

export const PLUGIN_SDK_VERSION = 2;

export enum PluginSlot {
  CONNECT_SCREEN = "connect_screen",
  HOME_SCREEN = "home_screen",
  CHAT_ACTIONS = "chat_actions",
  MESSAGE_ACTIONS = "message_actions",
  MESSAGE_FOOTER = "message_footer",
  MEMBER_LIST_ITEM = "member_list_item",
  USER_POPOVER = "user_popover",
  CHANNEL_HEADER = "channel_header",
  TOPBAR_RIGHT = "topbar_right",
  FULL_SCREEN = "full_screen",
  USER_SETTINGS = "user_settings",
  VOICE_CONTROLS = "voice_controls",
  VOICE_USER_CARD = "voice_user_card",
  VOICE_USER_ROW = "voice_user_row",
}

export enum PluginCapabilityType {
  COMMAND = "command",
  ACTION = "action",
  COMPONENT = "component",
  HTTP_ROUTE = "http_route",
  NOTIFICATION = "notification",
}

export type TPluginReactComponent<TProps = any> = React.ComponentType<TProps>;

export type TPluginComponentsMapBySlotId = {
  [S in PluginSlot]?: TPluginReactComponent<any>[];
};

export enum Permission {
  JOIN_VOICE_CHANNELS = "JOIN_VOICE_CHANNELS",
  MANAGE_PLUGINS = "MANAGE_PLUGINS",
  ADMIN = "ADMIN",
}

export type TPluginContract = any;
export type TContractPush<C extends TPluginContract = TPluginContract> = any;
export type TSharkordState = any;
export type AppData = any;
export type PlainTransport = any;
export type Producer = any;
export type Router = any;
export type TExternalStreamHandle = {
  streamId?: number;
  remove: () => void;
  update?: (options: any) => void;
};

export interface PluginContext<C extends TPluginContract = TPluginContract> {
  path: string;
  dataPath: string;
  logger: {
    log: (...args: any[]) => void;
    debug: (...args: any[]) => void;
    error: (...args: any[]) => void;
  };
  ui: {
    enable: (slots: Record<string, string>) => void;
    disable: () => void;
  };
  settings: {
    register: (settings: any[]) => Promise<{
      get: (key: string) => any;
    }>;
  };
  events: {
    on: (event: string, handler: (payload: any) => void) => void;
  };
  actions: {
    register: (action: {
      name: string;
      description?: string;
      requires?: string;
      executes: (ctx: any, payload?: any) => Promise<any> | any;
    }) => void;
  };
  commands: {
    register: (command: {
      name: string;
      description?: string;
      requires?: string;
      executes: (ctx: any, args?: any) => Promise<any> | any;
    }) => void;
  };
  voice: {
    getRouter: (channelId: number) => any;
    getListenInfo: () => { announcedAddress: string; ip: string };
    createStream: (options: {
      key: string;
      channelId: number;
      title: string;
      avatarUrl?: string;
      bannerUrl?: string;
      producers: { audio?: any; video?: any };
    }) => { remove: () => void };
  };
  push?: {
    toAll: (data: any) => void;
  };
  [key: string]: any;
}

export interface UnloadPluginContext {
  path: string;
  dataPath: string;
  logger: {
    log: (...args: any[]) => void;
    debug: (...args: any[]) => void;
    error: (...args: any[]) => void;
  };
  [key: string]: any;
}

export type PluginModule<C extends TPluginContract = TPluginContract> = {
  onLoad: (ctx: PluginContext<C>) => void | Promise<void>;
  onUnload?: (ctx: UnloadPluginContext) => void | Promise<void>;
  onUpgrade?: (ctx: any, info: any) => void | Promise<void>;
};
