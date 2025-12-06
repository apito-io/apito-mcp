# Deployment Guide

## Prerequisites

1. Cloudflare account with Workers enabled
2. Wrangler CLI installed (`npm install -g wrangler`)
3. Cloudflare API token or logged in via `wrangler login`

## Step 1: Authenticate with Cloudflare

```bash
wrangler login
```

## Step 2: Set Secrets

Set the Apito authentication token as a Cloudflare secret:

```bash
# For development
wrangler secret put APITO_AUTH_TOKEN --env development

# For production
wrangler secret put APITO_AUTH_TOKEN --env production
```

Optionally set the GraphQL endpoint:

```bash
wrangler secret put APITO_GRAPHQL_ENDPOINT --env development
```

## Step 3: Deploy

### Deploy Development Version

```bash
npm run deploy -- --env development
```

### Deploy Production Version

```bash
npm run deploy -- --env production
```

## Step 4: Get Deployment URL

After deployment, you'll get a URL like:

- Development: `https://apito-mcp-dev.YOUR_SUBDOMAIN.workers.dev`
- Production: `https://apito-mcp.YOUR_SUBDOMAIN.workers.dev`

## Step 5: Configure Cursor

Add to your Cursor MCP settings (usually `~/.cursor/mcp.json` or similar):

```json
{
  "mcpServers": {
    "apito": {
      "url": "https://apito-mcp-dev.YOUR_SUBDOMAIN.workers.dev",
      "transport": "http"
    }
  }
}
```

## Testing Locally (STDIO)

For local testing with stdio transport:

```bash
export APITO_AUTH_TOKEN="your-token-here"
export APITO_GRAPHQL_ENDPOINT="http://localhost:5050/secured/graphql"
node --loader ts-node/esm src/index.ts
```

Then configure Cursor for stdio:

```json
{
  "mcpServers": {
    "apito": {
      "command": "node",
      "args": [
        "--loader",
        "ts-node/esm",
        "/Users/diablo/Projects/apito/apito-mcp/src/index.ts"
      ],
      "env": {
        "APITO_AUTH_TOKEN": "your-token-here",
        "APITO_GRAPHQL_ENDPOINT": "http://localhost:5050/secured/graphql"
      }
    }
  }
}
```
