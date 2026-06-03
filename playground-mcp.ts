#!/usr/bin/env npx tsx

import { readFileSync } from 'node:fs';
import { ApitoMCPServer } from './src/index.js';

type McpServerConfig = {
  env?: Record<string, string>;
};

type McpConfig = {
  mcpServers?: Record<string, McpServerConfig>;
};

type Json = Record<string, unknown>;

const DEFAULT_CONFIG =
  '/Users/diablo/go/src/gitlab.com/apito.io/engine/.cursor/mcp.json';

const help = `Apito MCP playground

Usage:
  pnpm playground:mcp servers
  pnpm playground:mcp tools [server]
  pnpm playground:mcp resources [server]
  pnpm playground:mcp read [server] <uri>
  pnpm playground:mcp call [server] <tool> '<json-args>'
  pnpm playground:mcp relation-smoke [server] [known_as]

Defaults:
  server: kisti-db-mcp
  config: MCP_CONFIG_PATH or ${DEFAULT_CONFIG}

Examples:
  pnpm playground:mcp tools kisti-db-mcp
  pnpm playground:mcp call kisti-db-mcp get_schema_versioning_status '{}'
  pnpm playground:mcp call kisti-db-mcp list_models '{"source":"effective"}'
  pnpm playground:mcp call kisti-db-mcp get_model_schema '{"model_name":"movie","source":"effective"}'
  pnpm playground:mcp relation-smoke kisti-db-mcp debug_probe
`;

function loadConfig(): McpConfig {
  const configPath = process.env.MCP_CONFIG_PATH || DEFAULT_CONFIG;
  return JSON.parse(readFileSync(configPath, 'utf8')) as McpConfig;
}

function serverNames(config: McpConfig): string[] {
  return Object.keys(config.mcpServers ?? {}).filter((name) => {
    const env = config.mcpServers?.[name]?.env;
    return Boolean(env?.APITO_API_KEY && env?.APITO_GRAPHQL_ENDPOINT);
  });
}

function getServerConfig(config: McpConfig, name: string): McpServerConfig {
  const server = config.mcpServers?.[name];
  if (!server) {
    throw new Error(`MCP server "${name}" not found. Available: ${serverNames(config).join(', ')}`);
  }
  return server;
}

function createServer(serverConfig: McpServerConfig): ApitoMCPServer {
  const env = serverConfig.env ?? {};
  const token = env.APITO_API_KEY || env.APITO_AUTH_TOKEN;
  let endpoint = env.APITO_GRAPHQL_ENDPOINT;

  if (!token || !endpoint) {
    throw new Error('Selected MCP server missing APITO_API_KEY/APITO_AUTH_TOKEN or APITO_GRAPHQL_ENDPOINT');
  }

  if (endpoint.includes('/secured/graphql')) {
    endpoint = endpoint.replace('/secured/graphql', '/system/graphql');
  }

  return new ApitoMCPServer(endpoint, token, {
    tenantId: env.TENANT_ID || env.APITO_TENANT_ID,
    sendTempTenantCookie: env.APITO_MCP_TEMP_TENANT_COOKIE === 'true',
  });
}

function parseJsonArg(raw?: string): Json {
  if (!raw) {
    return {};
  }
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('JSON args must be an object');
  }
  return parsed as Json;
}

function textFromMcpResponse(response: any): string {
  const content = response?.result?.content ?? response?.result?.contents ?? [];
  return content
    .map((item: any) => item?.text ?? JSON.stringify(item, null, 2))
    .join('\n');
}

async function request(server: ApitoMCPServer, method: string, params: Json = {}) {
  const response = await server.handleMCPRequest({
    jsonrpc: '2.0',
    id: Date.now(),
    method,
    params,
  });

  if (response?.error) {
    throw new Error(response.error.message || JSON.stringify(response.error));
  }
  if (response?.result?.isError) {
    throw new Error(textFromMcpResponse(response));
  }
  return response;
}

async function listTools(server: ApitoMCPServer) {
  const response = await request(server, 'tools/list');
  for (const tool of response.result.tools ?? []) {
    console.log(`- ${tool.name}`);
  }
}

async function listResources(server: ApitoMCPServer) {
  const response = await request(server, 'resources/list');
  for (const resource of response.result.resources ?? []) {
    console.log(`- ${resource.uri} (${resource.name})`);
  }
}

async function readResource(server: ApitoMCPServer, uri: string) {
  const response = await request(server, 'resources/read', { uri });
  console.log(textFromMcpResponse(response));
}

async function callTool(server: ApitoMCPServer, name: string, args: Json) {
  const response = await request(server, 'tools/call', {
    name,
    arguments: args,
  });
  console.log(textFromMcpResponse(response) || JSON.stringify(response.result, null, 2));
  return response;
}

async function relationSmoke(server: ApitoMCPServer, knownAs?: string) {
  const relationName = knownAs || `playground_probe_${Date.now()}`;
  console.log(`Adding relation movie -> genre known_as=${relationName}`);
  await callTool(server, 'add_relation', {
    from_model: 'movie',
    to_model: 'genre',
    forward_connection_type: 'has_many',
    reverse_connection_type: 'has_many',
    known_as: relationName,
  });

  const response = await request(server, 'tools/call', {
    name: 'get_model_schema',
    arguments: {
      model_name: 'movie',
      source: 'effective',
    },
  });
  const text = textFromMcpResponse(response);
  if (!text.includes(`"known_as": "${relationName}"`)) {
    throw new Error(`Effective schema did not include relation ${relationName}`);
  }
  console.log(`PASS: effective schema contains ${relationName}`);
  console.log('Note: relation is draft-only. Reject/remove probe before publish if unwanted.');
}

async function main() {
  const [, , command, maybeServer, ...rest] = process.argv;
  const config = loadConfig();
  const defaultServer = 'kisti-db-mcp';

  if (!command || command === 'help' || command === '--help') {
    console.log(help);
    return;
  }

  if (command === 'servers') {
    for (const name of serverNames(config)) {
      console.log(`- ${name}`);
    }
    return;
  }

  const serverName = maybeServer || defaultServer;
  const server = createServer(getServerConfig(config, serverName));

  switch (command) {
    case 'tools':
      await listTools(server);
      break;
    case 'resources':
      await listResources(server);
      break;
    case 'read': {
      const uri = rest[0];
      if (!uri) {
        throw new Error('read requires <uri>');
      }
      await readResource(server, uri);
      break;
    }
    case 'call': {
      const tool = rest[0];
      if (!tool) {
        throw new Error('call requires <tool>');
      }
      await callTool(server, tool, parseJsonArg(rest[1]));
      break;
    }
    case 'relation-smoke':
      await relationSmoke(server, rest[0]);
      break;
    default:
      throw new Error(`Unknown command "${command}"\n\n${help}`);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
