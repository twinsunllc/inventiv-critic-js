import { CriticClient, DEFAULT_HOST } from "./client.js";
import type { BugReport } from "./types.js";

type Callback = (result: unknown) => void;

interface ReportOptions {
  host?: string;
  apiToken: string;
  appInstallId: string;
  description: string;
  metadata?: Record<string, unknown>;
  steps_to_reproduce?: string;
  user_identifier?: string;
  attachments?: File[];
  success?: Callback;
  failure?: Callback;
}

/**
 * Legacy convenience API for UMD/browser usage.
 *
 * Usage:
 *   Critic.Report.create({ apiToken: "...", appInstallId: "...", description: "..." })
 */
export const Critic = {
  host: DEFAULT_HOST,

  Report: {
    create(options: ReportOptions): Promise<BugReport> {
      const client = new CriticClient({
        host: options.host ?? Critic.host,
        apiToken: options.apiToken,
      });

      const promise = client.createBugReport(
        options.appInstallId,
        {
          description: options.description,
          metadata: options.metadata,
          steps_to_reproduce: options.steps_to_reproduce,
          user_identifier: options.user_identifier,
        },
        options.attachments,
      );

      if (options.success || options.failure) {
        promise.then(options.success, options.failure);
      }

      return promise;
    },
  },
};
