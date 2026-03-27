export const DEFAULT_HOST = "https://critic.inventiv.io";

export interface CriticConfig {
  host?: string;
}

export interface CreateReportOptions {
  productAccessToken: string;
  description: string;
  metadata?: Record<string, unknown>;
  attachments?: File[];
}

export interface CriticResponse {
  ok: boolean;
  status: number;
}

export class CriticClient {
  readonly host: string;

  constructor(config: CriticConfig = {}) {
    this.host = config.host ?? DEFAULT_HOST;
  }

  async createReport(options: CreateReportOptions): Promise<CriticResponse> {
    const formData = new FormData();
    formData.append("report[product_access_token]", options.productAccessToken);
    formData.append("report[description]", options.description);

    if (options.metadata) {
      formData.append("report[metadata]", JSON.stringify(options.metadata));
    }

    if (options.attachments) {
      for (const file of options.attachments) {
        formData.append("report[attachments][]", file);
      }
    }

    const response = await fetch(`${this.host}/api/v1/reports`, {
      method: "POST",
      body: formData,
    });

    return {
      ok: response.ok,
      status: response.status,
    };
  }
}
