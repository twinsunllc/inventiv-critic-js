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

export const DEFAULT_HOST = "https://critic.inventiv.io";

export class CriticClient {
  readonly host: string;
  private readonly apiToken: string;
  private readonly appApiToken: string | undefined;

  constructor(config: CriticConfig) {
    this.host = (config.host ?? DEFAULT_HOST).replace(/\/+$/, "");
    this.apiToken = config.apiToken;
    this.appApiToken = config.appApiToken;
  }

  /**
   * Register an app install with the Critic API.
   * POST /api/v3/ping
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
   * POST /api/v3/bug_reports (multipart)
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
   * GET /api/v3/bug_reports
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
   * GET /api/v3/bug_reports/:uuid
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
   * GET /api/v3/devices
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
