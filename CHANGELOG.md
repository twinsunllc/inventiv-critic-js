# Changelog

All notable changes to `@twinsunllc/inventiv-critic-js` are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Security

- Raised the `brace-expansion` override from `>= 5.0.7` to `>= 5.0.8` to
  remediate GHSA-mh99-v99m-4gvg (vulnerable `<= 5.0.7`, fixed in `5.0.8`), and
  the `js-yaml` override from `>= 4.3.0` to `>= 5.2.2` to remediate
  GHSA-pm4m-ph32-ghv5 (vulnerable `5.0.0`–`5.2.1`, fixed in `5.2.2`). The prior
  overrides had gone stale and still resolved to vulnerable versions
  (`brace-expansion@5.0.7`, `js-yaml@5.2.1`). Both patched releases were
  published 2026-07-23 and are temporarily added to
  `.github/quarantine-allowlist.yml` while inside the 7-day package-age
  quarantine window. Both remain dev-only transitive dependencies of ESLint; the
  published artifact is unaffected.
- Pinned the `postcss` npm override from `>= 8.5.10` to `8.5.19` to remediate
  GHSA-6g55-p6wh-862q (arbitrary file read and information disclosure via an
  attacker-controlled `sourceMappingURL` in CSS comments). The prior override
  resolved to `8.5.10`, which falls inside the advisory's vulnerable range
  (`<= 8.5.11`). `postcss` remains a dev-only transitive dependency (via `tsup`,
  `postcss-load-config`, and `vite`); the published artifact is unaffected.
- Bumped the `vite` npm override from `>= 8.0.5` to `>= 8.0.16` to remediate
  GHSA-fx2h-pf6j-xcff (`server.fs.deny` bypass) and GHSA-v6wh-96g9-6wx3
  (launch-editor NTLMv2 hash disclosure).
- Added a `js-yaml` override (`>= 4.2.0`) to remediate GHSA-h67p-54hq-rp68
  (quadratic-complexity DoS via YAML merge keys) pulled in transitively through
  ESLint. Both are dev-only dependencies; the published artifact is unaffected.
- Raised the `brace-expansion` override from `>= 5.0.6` to `>= 5.0.7` to
  remediate GHSA-3jxr-9vmj-r5cp (DoS via exponential-time expansion of
  consecutive non-expanding `{}` groups), and the `js-yaml` override from
  `>= 4.2.0` to `>= 4.3.0` to remediate GHSA-52cp-r559-cp3m (quadratic CPU
  consumption via YAML merge-key chains). The prior overrides were pinned to the
  inclusive upper bound of each advisory's vulnerable range and so still
  matched. Both remain dev-only transitive dependencies of ESLint; the published
  artifact is unaffected.

## [2.0.1] - 2026-04-09

### Changed

- Updated documentation URLs from `inventiv.io/critic` to `critictracking.com` in the README.

### Security

- Pinned `vite` to `>= 8.0.5` via npm overrides to pick up upstream security patches.

## [2.0.0] - 2026-03-30

### Breaking Changes

- **Complete TypeScript rewrite** — the package replaces the legacy jQuery-based `critic.js`
  script with a modern TypeScript SDK. The legacy `Critic.Report.create()` API is preserved as
  a compatibility shim but now runs through the new `CriticClient` under the hood.
- **v3 API migration** — all requests now target the `/api/v3/` endpoints
  (`POST /api/v3/ping`, `POST /api/v3/bug_reports`). The old v1/v2 GET endpoints have been
  removed from the client.
- **`captureConsoleLogs` defaults to `true`** — console log capture is now **opt-out**. Pass
  `captureConsoleLogs: false` in your `CriticConfig` to disable it. Previously capture was
  opt-in and not part of the public API.
- **Platform type is now a strict union** — `Platform` is `"Android" | "iOS" | "Web" | "Unknown"`.
  Any other string is rejected at the type level. Use `"Web"` (capital W) for web clients.
- **`appApiToken` removed** — only `apiToken` is accepted. The separate app-level API token
  parameter no longer exists.

### Added

- **`CriticClient` class** — primary entry point for the v3 API. Supports `ping()` to register
  an app install and `createBugReport()` to file a bug report with optional attachments.
- **`CriticClient#destroy()`** — stops console log capture and restores the original `console`
  methods. Call this when tearing down the client (e.g. during hot-module replacement or tests).
- **`ConsoleLogCapture` class** — captures `console.log/warn/error/info/debug` output plus
  `window.onerror` and `unhandledrejection` events into a bounded ring buffer (default 500
  entries). The buffer is automatically serialized and attached as `console-logs.txt` to every
  bug report created through `CriticClient`.
- **`getDeviceStatus()` helper** — collects battery level/charging state (Chromium Battery
  Status API), network type (Chromium Network Information API), and total/free memory
  (Chromium Device Memory API + Node.js `os` module) without requiring user permission. All
  APIs are feature-detected; missing fields are silently omitted.
- **Device status on ping and bug reports** — `CriticClient#ping()` and
  `CriticClient#createBugReport()` both accept an optional `DeviceStatus` parameter which is
  forwarded to the server.
- **TypeScript declarations** — full `.d.ts` output for all public types: `CriticConfig`,
  `AppInfo`, `DeviceInfo`, `DeviceStatus`, `AppInstall`, `BugReport`, `BugReportInput`,
  `Attachment`, `ConsoleLogLevel`, `ConsoleLogEntry`.
- **Dual ESM + CJS output** — the package ships `dist/index.js` (ESM) and `dist/index.cjs`
  (CommonJS) with matching type declarations, enabling use in both modern bundlers and legacy
  `require()` environments.
- **Legacy compatibility shim** — `Critic.Report.create(options)` mirrors the original
  jQuery-era API for codebases that cannot migrate immediately.

### Changed

- Nightly security CI now includes npm audit, a 7-day package quarantine check, and a GitHub
  Actions security scan.
- `console-logs.txt` is the standardized filename for captured log attachments (was previously
  unnamed/implementation-defined).
- Battery level is rounded to the nearest integer percent.

### Removed

- GET endpoints (`/api/v1/app_installs`, etc.) removed from the client. The server still
  supports them but they are not part of the SDK's public surface.
- jQuery dependency — the new implementation has zero runtime dependencies.

---

## [1.01] - 2024 (legacy)

Initial release of the jQuery-based `critic.js` browser script. Supported basic bug report
submission via the v1/v2 REST API.
