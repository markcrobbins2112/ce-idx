import path from "path";
import { build } from "bun";

const isProd = process.argv.includes("--production");

const config = {
  entrypoints: ["./src/extension.ts"],
  outdir: "./dist",
  naming: "extension.cjs",
  target: "node",
  format: "cjs",
  minify: isProd,
  // FIX: Force Bun to embed the sourcemaps directly inside the bundle text
  sourcemap: isProd ? "none" : "inline",
  external: ["vscode"],
  root: path.resolve(".")
};

const result = await build({
  entrypoints: ["./src/extension.ts"], // Adjust if your source path is different
  outdir: "./dist",
  naming: "extension.cjs", // Matches your package.json "main"

  // CRITICAL SETTINGS FOR VS CODE EXTENSIONS:
  target: "node",          // Compiles code safely for VS Code's Node.js runtime
  format: "cjs",           // Compiles to CommonJS format
  external: ["vscode"],   // Tells Bun NEVER to try to bundle the 'vscode' API module

  minify: isProd,
  sourcemap: isProd ? "none" : "inline",
});
if (!result.success) {
  console.error("Build failed:", result.logs);
  process.exit(1);
}
console.log("Bun compiling output generated successfully inside /dist!");
