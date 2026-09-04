import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const SCRIPT = fileURLToPath(new URL("../npm-audit.sh", import.meta.url));

const CLEAN_REPORT = JSON.stringify({
  auditReportVersion: 2,
  vulnerabilities: {},
  metadata: {
    vulnerabilities: { info: 0, low: 0, moderate: 0, high: 0, critical: 0, total: 0 },
    dependencies: { prod: 1, dev: 400, total: 401 },
  },
});

const VULNERABLE_REPORT = JSON.stringify({
  auditReportVersion: 2,
  vulnerabilities: {
    nanoid: {
      name: "nanoid",
      severity: "moderate",
      isDirect: false,
      via: [
        {
          source: 1109357,
          name: "nanoid",
          title: "Predictable results in nanoid generation when given non-integer values",
          url: "https://github.com/advisories/GHSA-2v37-7h3g-55p8",
          severity: "moderate",
          range: "<3.3.18",
        },
      ],
      effects: ["postcss"],
      range: "<3.3.18",
      nodes: ["node_modules/nanoid"],
      fixAvailable: { name: "nanoid", version: "3.3.18", isSemVerMajor: false },
    },
  },
  metadata: {
    vulnerabilities: { info: 0, low: 0, moderate: 1, high: 0, critical: 0, total: 1 },
    dependencies: { prod: 1, dev: 400, total: 401 },
  },
});

// npm answers an unavailable audit endpoint with an error payload rather than a
// report — the shape that turned a registry 503 into a failed security workflow.
const REGISTRY_ERROR_PAYLOAD = JSON.stringify({
  error: {
    code: "E503",
    summary:
      "503 Service Unavailable - POST https://registry.npmjs.org/-/npm/v1/security/audits/quick - Service Unavailable",
    detail: "",
  },
});

interface RunResult {
  status: number | null;
  stdout: string;
  stderr: string;
  attempts: number;
  argv: string;
  summary: string;
}

let workDir: string;

/**
 * Writes a stub `npm` onto disk whose body decides each response from the
 * 1-based attempt number in $ATTEMPT. Every invocation appends its argument list
 * to a log file, so both the attempt count and the flags the script passed are
 * assertable.
 */
function stubNpm(body: string): void {
  const invocationLog = path.join(workDir, "invocations");
  fs.writeFileSync(invocationLog, "");
  fs.writeFileSync(
    path.join(workDir, "npm"),
    [
      "#!/usr/bin/env bash",
      "set -u",
      `echo "$*" >>"${invocationLog}"`,
      `ATTEMPT=$(wc -l <"${invocationLog}" | tr -d " ")`,
      body,
      "",
    ].join("\n"),
    { mode: 0o755 },
  );
}

function run(env: Record<string, string> = {}): RunResult {
  const summaryFile = path.join(workDir, "step-summary.md");
  const invocationLog = path.join(workDir, "invocations");
  const result = spawnSync("bash", [SCRIPT], {
    encoding: "utf8",
    timeout: 60_000,
    env: {
      PATH: process.env.PATH ?? "",
      HOME: process.env.HOME ?? workDir,
      NPM_BIN: path.join(workDir, "npm"),
      RETRY_BASE_SECONDS: "0",
      GITHUB_STEP_SUMMARY: summaryFile,
      ...env,
    },
  });

  const argv = fs.readFileSync(invocationLog, "utf8");

  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    attempts: argv.split("\n").filter(Boolean).length,
    argv,
    summary: fs.existsSync(summaryFile) ? fs.readFileSync(summaryFile, "utf8") : "",
  };
}

describe("scripts/npm-audit.sh", () => {
  beforeEach(() => {
    workDir = fs.mkdtempSync(path.join(os.tmpdir(), "npm-audit-test-"));
  });

  afterEach(() => {
    fs.rmSync(workDir, { recursive: true, force: true });
  });

  it("retries a transient audit-endpoint error and passes once a clean result arrives", () => {
    stubNpm(`
      if [ "$ATTEMPT" -lt 3 ]; then
        echo "npm warn audit 503 Service Unavailable - POST https://registry.npmjs.org/-/npm/v1/security/audits/quick" >&2
        echo '${REGISTRY_ERROR_PAYLOAD}'
        exit 1
      fi
      echo '${CLEAN_REPORT}'
      exit 0
    `);

    const result = run();

    expect(result.status).toBe(0);
    expect(result.attempts).toBe(3);
    expect(result.stdout).toContain("Inconclusive result on attempt 1/4");
    expect(result.stdout).toContain("Inconclusive result on attempt 2/4");
    expect(result.stdout).toContain("no vulnerabilities at or above 'moderate'");
    expect(result.stdout).not.toContain("::warning::");
  });

  it("fails immediately without retrying when the audit reports real vulnerabilities", () => {
    stubNpm(`
      echo '${VULNERABLE_REPORT}'
      exit 1
    `);

    const result = run();

    expect(result.status).toBe(1);
    expect(result.attempts).toBe(1);
    expect(result.stdout).toContain("npm audit report");
    expect(result.stdout).toContain("nanoid — moderate — vulnerable range <3.3.18");
    expect(result.stdout).toContain("https://github.com/advisories/GHSA-2v37-7h3g-55p8");
    expect(result.stdout).toContain("fix available: nanoid@3.3.18");
    expect(result.stdout).toContain("::error::");
  });

  it("does not treat a zero exit as clean when the payload still reports findings", () => {
    stubNpm(`
      echo '${VULNERABLE_REPORT}'
      exit 0
    `);

    const result = run();

    expect(result.status).toBe(1);
    expect(result.attempts).toBe(1);
    expect(result.stdout).toContain("::error::");
  });

  it("warns and passes after every attempt is inconclusive", () => {
    stubNpm(`
      echo "npm error audit endpoint returned an error" >&2
      echo '${REGISTRY_ERROR_PAYLOAD}'
      exit 1
    `);

    const result = run({ AUDIT_MAX_ATTEMPTS: "3" });

    expect(result.status).toBe(0);
    expect(result.attempts).toBe(3);
    expect(result.stdout).toContain("::warning::");
    expect(result.stdout).toContain("this is not a clean audit result");
    expect(result.summary).toContain("npm audit could not be completed");
  });

  it("fails closed after exhausting attempts when AUDIT_FAIL_ON_REGISTRY_ERROR is true", () => {
    stubNpm(`
      echo "npm error audit endpoint returned an error" >&2
      echo '${REGISTRY_ERROR_PAYLOAD}'
      exit 1
    `);

    const result = run({ AUDIT_MAX_ATTEMPTS: "3", AUDIT_FAIL_ON_REGISTRY_ERROR: "true" });

    expect(result.status).toBe(1);
    expect(result.attempts).toBe(3);
    expect(result.stdout).toContain("::warning::");
    expect(result.summary).toContain("npm audit could not be completed");
  });

  it("classifies non-JSON output as inconclusive rather than as a clean audit", () => {
    stubNpm(`
      echo "npm notice something entirely unparseable"
      exit 0
    `);

    const result = run({ AUDIT_MAX_ATTEMPTS: "2" });

    expect(result.status).toBe(0);
    expect(result.attempts).toBe(2);
    expect(result.stdout).toContain("Inconclusive result on attempt 1/2");
    expect(result.stdout).toContain("::warning::");
    expect(result.stdout).not.toContain("no vulnerabilities at or above");
  });

  it("classifies empty output as inconclusive rather than as a clean audit", () => {
    stubNpm(`exit 0`);

    const result = run({ AUDIT_MAX_ATTEMPTS: "2" });

    expect(result.status).toBe(0);
    expect(result.attempts).toBe(2);
    expect(result.stdout).toContain("npm stdout was empty");
    expect(result.stdout).toContain("::warning::");
    expect(result.stdout).not.toContain("no vulnerabilities at or above");
  });

  it("honours AUDIT_MAX_ATTEMPTS and reports the configured backoff", () => {
    stubNpm(`
      echo '${REGISTRY_ERROR_PAYLOAD}'
      exit 1
    `);

    const result = run({ AUDIT_MAX_ATTEMPTS: "3", RETRY_BASE_SECONDS: "1" });

    expect(result.attempts).toBe(3);
    // RETRY_BASE_SECONDS * 2^n for n = 0, 1
    expect(result.stdout).toContain("Retrying in 1s...");
    expect(result.stdout).toContain("Retrying in 2s...");
  }, 30_000);

  it("passes AUDIT_LEVEL and a bounded fetch timeout through to npm", () => {
    stubNpm(`
      echo '${CLEAN_REPORT}'
      exit 0
    `);

    const result = run({ AUDIT_LEVEL: "high" });

    expect(result.status).toBe(0);
    expect(result.argv.trim()).toBe("audit --audit-level=high --json --fetch-timeout=120000");
    expect(result.stdout).toContain("no vulnerabilities at or above 'high'");
  });
});
