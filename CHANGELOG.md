# Changelog

All notable changes to `@twinsunllc/inventiv-critic-js` are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
