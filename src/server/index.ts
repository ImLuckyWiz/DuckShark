import type { PluginContext, UnloadPluginContext } from "@sharkord/plugin-sdk";

export const onLoad = async (ctx: PluginContext) => {
  // DuckShark is client-primary: each user controls ducking locally in their browser.
  // The server only needs to enable the UI slot bundle to serve the client code.
  ctx.ui.enable({});
  ctx.logger.log("DuckShark loaded");
};

export const onUnload = async (ctx: UnloadPluginContext) => {
  ctx.logger.log("DuckShark unloaded");
};
