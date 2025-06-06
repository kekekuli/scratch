import { build } from "esbuild";
import { nodeExternalsPlugin } from "esbuild-node-externals";

await build({
  entryPoints: ["src/server.ts"],
  bundle: true,
  outdir: "dist",
  platform: "node",
  format: "cjs",
  plugins: [nodeExternalsPlugin()],
  minify: true,
  sourcemap: true,
});
