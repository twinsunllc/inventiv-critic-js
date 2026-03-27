# Inventiv Critic JavaScript SDK

Official JavaScript/TypeScript client for [Inventiv Critic](https://inventiv.io/critic/).

## Installation

```bash
npm install inventiv-critic-js
```

## Usage

### ES Modules / TypeScript

```typescript
import { CriticClient } from "inventiv-critic-js";

const critic = new CriticClient();

await critic.createReport({
  productAccessToken: "YOUR_PRODUCT_ACCESS_TOKEN",
  description: "User feedback description",
  metadata: { browser: navigator.userAgent },
});
```

### CommonJS

```javascript
const { CriticClient } = require("inventiv-critic-js");

const critic = new CriticClient();
```

### Script Tag (UMD/IIFE)

```html
<script src="dist/index.global.js"></script>
<script>
  const client = new Critic.CriticClient();
</script>
```

## Configuration

```typescript
const critic = new CriticClient({
  host: "https://custom-critic-host.example.com", // default: https://critic.inventiv.io
});
```

## Development

```bash
nvm use              # Use correct Node version
npm install          # Install dependencies
npm run build        # Build ESM, CJS, and IIFE bundles
npm test             # Run tests
npm run lint         # Lint and format check
npm run typecheck    # Type check
```

## Requirements

- Node.js 20 LTS or later
- No runtime dependencies (uses native `fetch()`)
