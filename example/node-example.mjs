/**
 * Node.js usage example for the Inventiv Critic JS SDK.
 *
 * Prerequisites:
 *   npm run build          # build the SDK first
 *
 * Usage:
 *   API_TOKEN=your-org-token node example/node-example.mjs
 *
 * To target a local Critic instance:
 *   API_TOKEN=your-org-token CRITIC_HOST=http://localhost:8000 node example/node-example.mjs
 */

// When installed from npm, use:
//   import { CriticClient, CriticError, AuthError } from "@twinsunllc/critic";
// During development with this repo:
import { CriticClient, CriticError, AuthError } from "../dist/index.js";

const API_TOKEN = process.env.API_TOKEN;
const CRITIC_HOST = process.env.CRITIC_HOST; // optional: override the default host

if (!API_TOKEN) {
  console.error("Set API_TOKEN environment variable before running this example.");
  process.exit(1);
}

const client = new CriticClient({
  apiToken: API_TOKEN,
  ...(CRITIC_HOST ? { host: CRITIC_HOST } : {}),
});

console.log(`Using Critic host: ${client.host}`);

// --- 1. Register an app install (ping) ---
try {
  const install = await client.ping(
    {
      name: "My Node App",
      package: "com.example.nodeapp",
      platform: "Web",
      version: { code: "1", name: "1.0.0" },
    },
    {
      identifier: `node-${process.pid}`,
      manufacturer: "Node.js",
      model: process.version,
      network_carrier: "N/A",
      platform: "Web",
      platform_version: process.versions.node,
    },
  );
  console.log("App install registered:", install.id);

  // --- 2. Create a bug report ---
  const report = await client.createBugReport(install.id, {
    description: "Example bug report from Node.js",
    metadata: { node_version: process.version, example: true },
    steps_to_reproduce: "1. Run the example script\n2. Observe this report",
  });
  console.log("Bug report created:", report.id);
} catch (err) {
  if (err instanceof AuthError) {
    console.error("Authentication failed:", err.message);
  } else if (err instanceof CriticError) {
    console.error("API error:", err.message, `(status ${err.status})`);
  } else {
    throw err;
  }
}
