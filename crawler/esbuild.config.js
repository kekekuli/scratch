import { build } from "esbuild";
import { nodeExternalsPlugin } from "esbuild-node-externals";

await build({
  entryPoints: ["index.ts"],
  bundle: true,
  outdir: "dist",
  platform: "node",
  format: "esm",
  plugins: [nodeExternalsPlugin()],
  minify: true,
});
