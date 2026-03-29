# Inventiv Critic JavaScript SDK

Official JavaScript/TypeScript client for [Inventiv Critic](https://inventiv.io/critic/).

Supports ESM, CommonJS, and browser `<script>` tag usage. Zero runtime dependencies — uses native `fetch()`.

## Installation

```bash
npm install @twinsunllc/critic
```

## Quick Start

### ES Modules / TypeScript

```typescript
import { CriticClient } from "@twinsunllc/critic";

const client = new CriticClient({
  apiToken: "YOUR_ORG_API_TOKEN",
});

// 1. Register an app install
const install = await client.ping(
  {
    name: "My App",
    package: "com.example.myapp",
    platform: "Web",
    version: { code: "42", name: "2.1.0" },
  },
  {
    identifier: "device-abc",
    manufacturer: "Browser",
    model: navigator.userAgent,
    platform: "Web",
    platform_version: navigator.appVersion,
  },
);

// 2. Submit a bug report
await client.createBugReport(install.id, {
  description: "The button on the settings page is unresponsive",
  metadata: { page: "/settings", browser: navigator.userAgent },
});
```

### CommonJS

```javascript
const { CriticClient } = require("@twinsunllc/critic");

const client = new CriticClient({
  apiToken: "YOUR_ORG_API_TOKEN",
});
```

### Script Tag (Browser)

```html
<script src="https://unpkg.com/@twinsunllc/critic/dist/index.global.js"></script>
<script>
  const client = new Critic.CriticClient({
    apiToken: "YOUR_ORG_API_TOKEN",
  });

  client
    .createBugReport("APP_INSTALL_ID", {
      description: "User feedback from the web",
      metadata: { rating: 5 },
    })
    .then(() => alert("Thanks for your feedback!"))
    .catch((err) => console.error(err));
</script>
```

### Node.js

```bash
API_TOKEN=your-token node example/node-example.mjs
```

See [`example/node-example.mjs`](example/node-example.mjs) for a complete Node.js example demonstrating ping, bug report creation, and listing endpoints.

## Configuration

```typescript
const client = new CriticClient({
  // Required: organization-level API token (used for POST endpoints)
  apiToken: "YOUR_ORG_API_TOKEN",

  // Optional: override the API host (default: https://critic.inventiv.io)
  host: "https://custom-critic-host.example.com",
});
```

## API Reference

### `client.ping(app, device, deviceStatus?)`

Register an app install. Returns an `AppInstall` with an `id` you'll use for bug reports.

### `client.createBugReport(appInstallId, report, attachments?, deviceStatus?)`

Submit a bug report with optional file attachments and device status.

## Error Handling

```typescript
import { CriticError, AuthError } from "@twinsunllc/critic";

try {
  await client.ping(app, device);
} catch (err) {
  if (err instanceof AuthError) {
    // 401 or 403 — invalid or expired token
    console.error("Auth failed:", err.message, err.status);
  } else if (err instanceof CriticError) {
    // Other API error (4xx, 5xx)
    console.error("API error:", err.message, err.status, err.body);
  }
}
```

## Development

```bash
nvm use              # Use correct Node version (20 LTS)
npm install          # Install dependencies
npm run build        # Build ESM, CJS, and IIFE bundles
npm test             # Run tests
npm run lint         # Lint and format check
npm run typecheck    # Type check
```

## Requirements

- Node.js 20 LTS or later
- No runtime dependencies (uses native `fetch()`)

## License

MIT
