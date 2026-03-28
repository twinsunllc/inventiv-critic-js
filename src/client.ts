import { CriticError, AuthError } from "./errors.js";
import type {
  CriticConfig,
  AppInfo,
  DeviceInfo,
  DeviceStatus,
  AppInstall,
  BugReport,
  BugReportInput,
  Device,
  PaginatedResponse,
  ListBugReportsOptions,
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
  private readonly appApiToken: string | undefined;

  /**
   * Create a new CriticClient.
   *
   * @param config - Client configuration including API tokens and optional host override.
   */
  constructor(config: CriticConfig) {
    this.host = (config.host ?? DEFAULT_HOST).replace(/\/+$/, "");
    this.apiToken = config.apiToken;
    this.appApiToken = config.appApiToken;
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

  /**
   * List bug reports.
   *
   * Sends a `GET /api/v3/bug_reports` request. Requires {@link CriticConfig.appApiToken}.
   *
   * @param options - Optional filters (archived, device_id, since).
   * @returns A {@link PaginatedResponse} of {@link BugReport} items.
   * @throws {@link CriticError} if `appApiToken` was not provided.
   */
  async listBugReports(options?: ListBugReportsOptions): Promise<PaginatedResponse<BugReport>> {
    this.requireAppApiToken();

    const params = new URLSearchParams();
    params.set("app_api_token", this.appApiToken!);

    if (options?.archived !== undefined) {
      params.set("archived", String(options.archived));
    }
    if (options?.device_id) {
      params.set("device_id", options.device_id);
    }
    if (options?.since) {
      params.set("since", options.since);
    }

    const response = await fetch(`${this.host}/api/v3/bug_reports?${params.toString()}`);
    await this.assertOk(response);

    const data = (await response.json()) as {
      count: number;
      current_page: number;
      total_pages: number;
      bug_reports: BugReport[];
    };

    return {
      count: data.count,
      current_page: data.current_page,
      total_pages: data.total_pages,
      items: data.bug_reports,
    };
  }

  /**
   * Get a single bug report by UUID.
   *
   * Sends a `GET /api/v3/bug_reports/:uuid` request. Requires {@link CriticConfig.appApiToken}.
   *
   * @param id - The bug report UUID.
   * @returns The matching {@link BugReport}.
   * @throws {@link CriticError} if `appApiToken` was not provided or the report is not found.
   */
  async getBugReport(id: string): Promise<BugReport> {
    this.requireAppApiToken();

    const params = new URLSearchParams();
    params.set("app_api_token", this.appApiToken!);

    const response = await fetch(
      `${this.host}/api/v3/bug_reports/${encodeURIComponent(id)}?${params.toString()}`,
    );
    await this.assertOk(response);
    return (await response.json()) as BugReport;
  }

  /**
   * List devices.
   *
   * Sends a `GET /api/v3/devices` request. Requires {@link CriticConfig.appApiToken}.
   *
   * @returns A {@link PaginatedResponse} of {@link Device} items.
   * @throws {@link CriticError} if `appApiToken` was not provided.
   */
  async listDevices(): Promise<PaginatedResponse<Device>> {
    this.requireAppApiToken();

    const params = new URLSearchParams();
    params.set("app_api_token", this.appApiToken!);

    const response = await fetch(`${this.host}/api/v3/devices?${params.toString()}`);
    await this.assertOk(response);

    const data = (await response.json()) as {
      count: number;
      current_page: number;
      total_pages: number;
      devices: Device[];
    };

    return {
      count: data.count,
      current_page: data.current_page,
      total_pages: data.total_pages,
      items: data.devices,
    };
  }

  // ---- private helpers ----

  private requireAppApiToken(): void {
    if (!this.appApiToken) {
      throw new CriticError("appApiToken is required for GET endpoints", 0);
    }
  }

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
