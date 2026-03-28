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
 * Provides a simplified interface that mirrors the original jQuery-based `critic.js` API
 * while using the modern {@link CriticClient} under the hood.
 *
 * @example
 * ```html
 * <script src="dist/index.global.js"></script>
 * <script>
 *   Critic.Critic.Report.create({
 *     apiToken: "YOUR_TOKEN",
 *     appInstallId: "INSTALL_ID",
 *     description: "Something broke",
 *   });
 * </script>
 * ```
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
