/**
 * Node.js usage example for the Inventiv Critic JS SDK.
 *
 * Prerequisites:
 *   npm install @twinsunllc/critic
 *
 * Usage:
 *   API_TOKEN=your-org-token APP_API_TOKEN=your-app-token node example/node-example.mjs
 */

// When installed from npm, use:
//   import { CriticClient, CriticError, AuthError } from "@twinsunllc/critic";
// During development with this repo:
import { CriticClient, CriticError, AuthError } from "../dist/index.js";

const API_TOKEN = process.env.API_TOKEN;
const APP_API_TOKEN = process.env.APP_API_TOKEN;

if (!API_TOKEN) {
  console.error("Set API_TOKEN environment variable before running this example.");
  process.exit(1);
}

const client = new CriticClient({
  apiToken: API_TOKEN,
  appApiToken: APP_API_TOKEN,
  // host: "https://custom-host.example.com",  // optional override
});

// --- 1. Register an app install (ping) ---
try {
  const install = await client.ping(
    {
      name: "My Node App",
      package: "com.example.nodeapp",
      platform: "node",
      version: { code: "1", name: "1.0.0" },
    },
    {
      identifier: `node-${process.pid}`,
      manufacturer: "Node.js",
      model: process.version,
      platform: process.platform,
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

// --- 3. List bug reports (requires APP_API_TOKEN) ---
if (APP_API_TOKEN) {
  try {
    const page = await client.listBugReports();
    console.log(`Found ${page.count} bug report(s) (page ${page.current_page}/${page.total_pages})`);
    for (const report of page.items) {
      console.log(`  - ${report.id}: ${report.description}`);
    }
  } catch (err) {
    console.error("Failed to list bug reports:", err.message);
  }

  // --- 4. List devices ---
  try {
    const devices = await client.listDevices();
    console.log(`Found ${devices.count} device(s)`);
    for (const device of devices.items) {
      console.log(`  - ${device.identifier} (${device.manufacturer} ${device.model})`);
    }
  } catch (err) {
    console.error("Failed to list devices:", err.message);
  }
}
