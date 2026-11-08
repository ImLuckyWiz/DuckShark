import fs from "fs/promises";
import path from "path";

const pluginRootDir = process.cwd();
const distDir = path.join(pluginRootDir, "dist");
const manifestPath = path.join(pluginRootDir, "manifest.json");
const manifest = await Bun.file(manifestPath).json();
const outDir = path.join(distDir, manifest.id);

console.log(`Cleaning dist directory: ${distDir}`);
await fs.rm(distDir, { recursive: true, force: true });
await fs.mkdir(path.join(outDir, "server"), { recursive: true });
await fs.mkdir(path.join(outDir, "client"), { recursive: true });

// 1. Bundle server
console.log("Bundling server from src/server/index.ts...");
const serverEntry = path.join(pluginRootDir, "src/server/index.ts");
const serverResult = await Bun.build({
  entrypoints: [serverEntry],
  outdir: path.join(outDir, "server"),
  target: "bun",
  minify: true,
  format: "esm",
  external: ["react", "react-dom"],
});

if (!serverResult.success) {
  console.error("Server bundling failed:\n", serverResult.logs);
  process.exit(1);
}

// 2. Bundle client
console.log("Bundling client from src/client/index.ts...");
const clientGlobals = {
  name: "client-globals",
  setup(build: any) {
    const globals: Record<string, string> = {
      react: "window.__SHARKORD_REACT__",
      "react/jsx-runtime": "window.__SHARKORD_REACT_JSX__",
      "react/jsx-dev-runtime": "window.__SHARKORD_REACT_JSX_DEV__",
      "react-dom": "window.__SHARKORD_REACT_DOM__",
      "react-dom/client": "window.__SHARKORD_REACT_DOM_CLIENT__",
    };
    for (const [mod, global] of Object.entries(globals)) {
      build.onResolve({ filter: new RegExp(`^${mod.replace("/", "\\/")}$`) }, () => ({
        path: mod,
        namespace: "client-global",
      }));
      build.onLoad({ filter: new RegExp(`^${mod.replace("/", "\\/")}$`), namespace: "client-global" }, () => ({
        contents: `module.exports = ${global};`,
        loader: "js",
      }));
    }
  },
};

const clientEntry = path.join(pluginRootDir, "src/client/index.ts");
const clientResult = await Bun.build({
  entrypoints: [clientEntry],
  outdir: path.join(outDir, "client"),
  target: "browser",
  minify: true,
  format: "esm",
  plugins: [clientGlobals],
  define: { "process.env.NODE_ENV": '"production"' },
});

if (!clientResult.success) {
  console.error("Client bundling failed:\n", clientResult.logs.join("\n"));
  process.exit(1);
}

// 3. Copy manifest.json
console.log("Copying manifest.json...");
await fs.copyFile(manifestPath, path.join(outDir, "manifest.json"));

// 4. Archive into tarball
const tarName = `${manifest.id}-${manifest.version}.tar.gz`;
const archivePath = path.join(distDir, tarName);

console.log(`Packaging archive ${tarName} using tar -czf...`);
const proc = Bun.spawn({
  cmd: ["tar", "-czf", archivePath, "-C", distDir, manifest.id],
  stdout: "inherit",
  stderr: "inherit",
});
const exitCode = await proc.exited;
if (exitCode !== 0) {
  console.error(`Tar packaging failed with exit code ${exitCode}`);
  process.exit(1);
}

// 5. Version metadata file with SHA-256
const hasher = new Bun.CryptoHasher("sha256");
hasher.update(await Bun.file(archivePath).arrayBuffer());
const checksum = hasher.digest("hex");
const stat = await fs.stat(archivePath);

const downloadUrl =
  process.env.DOWNLOAD_URL ||
  `https://github.com/ImLuckyWiz/DuckShark/releases/download/v${manifest.version}/${tarName}`;

const versionData = {
  version: manifest.version,
  downloadUrl,
  checksum,
  sdkVersion: manifest.sdkVersion ?? 2,
  size: stat.size,
  timestamp: Date.now(),
};

const versionPath = path.join(distDir, `${manifest.version}.json`);
await fs.writeFile(versionPath, JSON.stringify(versionData, null, 2), "utf-8");

// 6. Optionally deploy to Sharkord plugins folder if configured
const pluginsEnvPath = process.env.SHARKORD_PLUGINS_PATH;
if (pluginsEnvPath) {
  const targetDir = path.join(pluginsEnvPath, manifest.id);
  console.log(`Deploying plugin to SHARKORD_PLUGINS_PATH: ${targetDir}`);
  await fs.cp(outDir, targetDir, { recursive: true });
}

console.log(`\nBuild successfully finished!`);
console.log(`Output folder: ${outDir}`);
console.log(`Archive: ${archivePath} (${stat.size} bytes)`);
console.log(`SHA-256: ${checksum}`);
console.log(`Version info: ${versionPath}`);
