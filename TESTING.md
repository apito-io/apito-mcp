# Testing Guide

## Local Testing (STDIO)

The MCP server has been configured in `~/.cursor/mcp.json` for local testing.

### Prerequisites

1. Apito server running on `http://localhost:5050`
2. Node.js and npm installed
3. Dependencies installed: `npm install`

### Test the Server

1. Restart Cursor to load the new MCP configuration
2. The MCP server will start automatically when Cursor connects
3. Test by asking Cursor to create a model named "fahim"

### Example Test Command

In Cursor chat, try:

```
Use the apito MCP server to create a model named "fahim"
```

Or more specifically:

```
Call the create_model tool from apito MCP with model_name="fahim"
```

## Cloudflare Deployment

### Development (Test) Version

- URL: `https://apito-mcp-dev.apito.workers.dev`
- Status: ✅ Deployed
- Secrets: Configured with token and endpoint

### Production Version

- Will be deployed after local testing is confirmed

## Troubleshooting

### Server Not Starting

- Check that Apito server is running on localhost:5050
- Verify the token is correct
- Check Cursor logs for MCP errors

### Connection Issues

- Ensure `ts-node` is installed: `npm install --save-dev ts-node`
- Verify the path to `src/index.ts` is correct
- Check environment variables are set correctly

### Model Creation Fails

- Verify the Bearer token has proper permissions
- Check Apito server logs
- Ensure the GraphQL endpoint is accessible
