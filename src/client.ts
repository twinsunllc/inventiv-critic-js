import { ConsoleLogCapture } from "./console-capture.js";
import { CriticError, AuthError } from "./errors.js";
import type {
  CriticConfig,
  AppInfo,
  DeviceInfo,
  DeviceStatus,
  AppInstall,
  BugReport,
  BugReportInput,
} from "./types.js";

/** Default Critic API host. */
export const DEFAULT_HOST = "https://critic.inventiv.io";

/**
 * Client for the Inventiv Critic v3 API.
 *
 * @example
 * ```ts
 * const client = new CriticClient({ apiToken: "org-token" });
 * const install = await client.ping(appInfo, deviceInfo);
 * await client.createBugReport(install.id, { description: "Something broke" });
 * ```
 */
export class CriticClient {
  /** The resolved API host URL (trailing slashes stripped). */
  readonly host: string;
  private readonly apiToken: string;

  /** Console log capture instance (only present when `captureConsoleLogs` is enabled). */
  private readonly consoleCapture: ConsoleLogCapture | null = null;

  /**
   * Create a new CriticClient.
   *
   * @param config - Client configuration including API tokens and optional host override.
   */
  constructor(config: CriticConfig) {
    this.host = (config.host ?? DEFAULT_HOST).replace(/\/+$/, "");
    this.apiToken = config.apiToken;

    if (config.captureConsoleLogs !== false) {
      this.consoleCapture = new ConsoleLogCapture();
      this.consoleCapture.start();
    }
  }

  /**
   * Stop console log capture and restore original console methods.
   * No-op if capture was not enabled.
   */
  destroy(): void {
    this.consoleCapture?.stop();
  }

  /**
   * Register an app install with the Critic API.
   *
   * Sends a `POST /api/v3/ping` request with application and device metadata.
   *
   * @param app - Application metadata (name, package, platform, version).
   * @param device - Device metadata (identifier, manufacturer, model, etc.).
   * @param deviceStatus - Optional device status information (battery, network, etc.).
   * @returns The registered {@link AppInstall} containing the install ID.
   * @throws {@link AuthError} if the API token is invalid (401/403).
   * @throws {@link CriticError} on any other non-OK response.
   */
  async ping(app: AppInfo, device: DeviceInfo, deviceStatus?: DeviceStatus): Promise<AppInstall> {
    const body: Record<string, unknown> = {
      api_token: this.apiToken,
      app,
      device,
    };
    if (deviceStatus) {
      body.device_status = deviceStatus;
    }

    const data = await this.postJson<{ app_install: AppInstall }>("/api/v3/ping", body);
    return data.app_install;
  }

  /**
   * Create a bug report.
   *
   * Sends a multipart `POST /api/v3/bug_reports` request.
   *
   * @param appInstallId - The app install ID returned by {@link ping}.
   * @param report - Bug report fields (description, optional metadata/steps/user identifier).
   * @param attachments - Optional file attachments (screenshots, logs, etc.).
   * @param deviceStatus - Optional device status snapshot.
   * @returns The created {@link BugReport}.
   * @throws {@link AuthError} on 401/403.
   * @throws {@link CriticError} on any other non-OK response.
   */
  async createBugReport(
    appInstallId: string,
    report: BugReportInput,
    attachments?: File[],
    deviceStatus?: DeviceStatus,
  ): Promise<BugReport> {
    const formData = new FormData();
    formData.append("api_token", this.apiToken);
    formData.append("app_install[id]", appInstallId);
    formData.append("bug_report[description]", report.description);

    if (report.metadata) {
      formData.append("bug_report[metadata]", JSON.stringify(report.metadata));
    }
    if (report.steps_to_reproduce) {
      formData.append("bug_report[steps_to_reproduce]", report.steps_to_reproduce);
    }
    if (report.user_identifier) {
      formData.append("bug_report[user_identifier]", report.user_identifier);
    }

    if (attachments) {
      for (const file of attachments) {
        formData.append("bug_report[attachments][]", file);
      }
    }

    // Auto-attach captured console logs when capture is enabled
    const consoleLogFile = this.consoleCapture?.toFile();
    if (consoleLogFile) {
      formData.append("bug_report[attachments][]", consoleLogFile);
    }

    if (deviceStatus) {
      for (const [key, value] of Object.entries(deviceStatus)) {
        if (value != null) {
          formData.append(`device_status[${key}]`, String(value));
        }
      }
    }

    const response = await fetch(`${this.host}/api/v3/bug_reports`, {
      method: "POST",
      body: formData,
    });

    await this.assertOk(response);
    return (await response.json()) as BugReport;
  }

  // ---- private helpers ----

  private async postJson<T>(path: string, body: unknown): Promise<T> {
    const response = await fetch(`${this.host}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    await this.assertOk(response);
    return (await response.json()) as T;
  }

  private async assertOk(response: Response): Promise<void> {
    if (response.ok) return;

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      body = await response.text().catch(() => null);
    }

    const message =
      typeof body === "object" && body !== null && "error" in body
        ? String((body as Record<string, unknown>).error)
        : `Critic API error (${response.status})`;

    if (response.status === 401 || response.status === 403) {
      throw new AuthError(message, response.status, body);
    }
    throw new CriticError(message, response.status, body);
  }
}
