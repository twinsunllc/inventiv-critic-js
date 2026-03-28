export { CriticClient, DEFAULT_HOST } from "./client.js";
export { ConsoleLogCapture } from "./console-capture.js";
export { getDeviceStatus } from "./device-status.js";
export { CriticError, AuthError } from "./errors.js";
export { Critic } from "./legacy.js";
export type {
  CriticConfig,
  AppInfo,
  DeviceInfo,
  DeviceStatus,
  AppInstall,
  BugReport,
  BugReportInput,
  Attachment,
} from "./types.js";
export type { ConsoleLogLevel, ConsoleLogEntry } from "./console-capture.js";
