import { CriticClient, DEFAULT_HOST } from "./client.js";
import { getDeviceStatus } from "./device-status.js";
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
    async create(options: ReportOptions): Promise<BugReport> {
      const client = new CriticClient({
        host: options.host ?? Critic.host,
        apiToken: options.apiToken,
      });

      const deviceStatus = await getDeviceStatus();

      const promise = client.createBugReport(
        options.appInstallId,
        {
          description: options.description,
          metadata: options.metadata,
          steps_to_reproduce: options.steps_to_reproduce,
          user_identifier: options.user_identifier,
        },
        options.attachments,
        deviceStatus,
      );

      if (options.success || options.failure) {
        promise.then(options.success, options.failure);
        // Swallow the rejection here so callers using the callback style
        // (who don't await the return value) don't trigger an unhandled
        // rejection. The failure callback above is responsible for handling it.
        return promise.catch(() => undefined as unknown as BugReport);
      }

      return promise;
    },
  },
};
