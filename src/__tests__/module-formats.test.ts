import { describe, it, expect } from "vitest";
import { execSync } from "node:child_process";
import { resolve } from "node:path";
import { readFileSync } from "node:fs";

const ROOT = resolve(import.meta.dirname, "../..");

describe("ESM import", () => {
  it("can be imported as ESM and exports expected symbols", () => {
    const script = `
      import { CriticClient, DEFAULT_HOST, CriticError, AuthError, Critic } from "./dist/index.js";
      const checks = [
        typeof CriticClient === "function",
        typeof DEFAULT_HOST === "string",
        typeof CriticError === "function",
        typeof AuthError === "function",
        typeof Critic === "object",
        typeof Critic.Report.create === "function",
      ];
      if (!checks.every(Boolean)) {
        process.exit(1);
      }
      console.log("ESM OK");
    `;

    const result = execSync(`node --input-type=module -e '${script}'`, {
      cwd: ROOT,
      encoding: "utf-8",
    });
    expect(result.trim()).toBe("ESM OK");
  });
});

describe("CJS require", () => {
  it("can be required as CJS and exports expected symbols", () => {
    const script = `
      const m = require("./dist/index.cjs");
      const checks = [
        typeof m.CriticClient === "function",
        typeof m.DEFAULT_HOST === "string",
        typeof m.CriticError === "function",
        typeof m.AuthError === "function",
        typeof m.Critic === "object",
        typeof m.Critic.Report.create === "function",
      ];
      if (!checks.every(Boolean)) {
        process.exit(1);
      }
      console.log("CJS OK");
    `;

    const result = execSync(`node --input-type=commonjs -e "${script.replace(/"/g, '\\"')}"`, {
      cwd: ROOT,
      encoding: "utf-8",
    });
    expect(result.trim()).toBe("CJS OK");
  });
});

describe("IIFE / UMD browser global", () => {
  it("global bundle defines Critic namespace with expected exports", () => {
    const globalJs = readFileSync(resolve(ROOT, "dist/index.global.js"), "utf-8");

    // Simulate a browser-like global scope by running the IIFE in a Node context
    const script = `
      var globalThis = this;
      ${globalJs}
      var C = globalThis.Critic || Critic;
      var checks = [
        typeof C.CriticClient === "function",
        typeof C.DEFAULT_HOST === "string",
        typeof C.CriticError === "function",
        typeof C.AuthError === "function",
        typeof C.Critic === "object",
      ];
      if (!checks.every(Boolean)) {
        process.exit(1);
      }
      console.log("IIFE OK");
    `;

    const result = execSync(`node -e '${script.replace(/'/g, "'\\''")}'`, {
      cwd: ROOT,
      encoding: "utf-8",
    });
    expect(result.trim()).toBe("IIFE OK");
  });
});
