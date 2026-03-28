/** Configuration for the Critic API client. */
export interface CriticConfig {
  /** Base URL for the Critic API. Defaults to https://critic.inventiv.io */
  host?: string;
  /** Organization-level API token used for POST endpoints. */
  apiToken: string;
  /**
   * When `true`, wraps global `console` methods to capture the last 500 log
   * entries. The captured logs are automatically attached as a text file to
   * bug reports created via {@link CriticClient.createBugReport}.
   *
   * Defaults to `false` because it modifies global `console` methods.
   */
  captureConsoleLogs?: boolean;
}

/** Application metadata sent during ping. */
export interface AppInfo {
  name: string;
  package: string;
  platform: string;
  version: {
    code: string;
    name: string;
  };
}

/** Device metadata sent during ping. */
export interface DeviceInfo {
  identifier: string;
  manufacturer: string;
  model: string;
  network_carrier?: string;
  platform: string;
  platform_version: string;
}

/** Device status information. */
export interface DeviceStatus {
  [key: string]: string | number | boolean | null | undefined;
}

/** Represents a registered app install returned by the ping endpoint. */
export interface AppInstall {
  id: string;
}

/** File attachment on a bug report. */
export interface Attachment {
  id: string;
  file_file_name: string;
  file_file_size: number;
  file_content_type: string;
  file_updated_at: string;
  url: string;
}

/** A bug report returned by the API. */
export interface BugReport {
  id: string;
  description: string;
  metadata: Record<string, unknown> | null;
  steps_to_reproduce: string | null;
  user_identifier: string | null;
  created_at: string;
  updated_at: string;
  attachments: Attachment[];
  [key: string]: unknown;
}

/** Input for creating a new bug report. */
export interface BugReportInput {
  description: string;
  metadata?: Record<string, unknown>;
  steps_to_reproduce?: string;
  user_identifier?: string;
}
