import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: ["src/index.ts"],
    format: ["esm", "cjs"],
    dts: true,
    clean: true,
    sourcemap: true,
    splitting: false,
  },
  {
    entry: ["src/index.ts"],
    format: ["iife"],
    globalName: "Critic",
    outDir: "dist",
    sourcemap: true,
    splitting: false,
    outExtension: () => ({ js: ".global.js" }),
  },
]);
