/**
 * Cloudflare Worker entry point for Apito MCP Server
 * Implements SSE (Server-Sent Events) transport for remote MCP access
 * Based on Cloudflare's remote MCP server guide: https://developers.cloudflare.com/agents/guides/remote-mcp-server/
 */

import { ApitoMCPServer } from './index.js';
import { projectScopeConfigFromEnv } from './project-scope.js';

export interface Env {
    APITO_GRAPHQL_ENDPOINT?: string;
    APITO_ALLOWED_PROJECT_IDS?: string;
    APITO_DEFAULT_PROJECT_ID?: string;
    APITO_ALLOWED_TENANTS_BY_PROJECT?: string;
    APITO_PROJECT_SCOPE_TTL_SECONDS?: string;
}

// Cache server instances per API key (since API keys are project-dependent)
const serverCache = new Map<string, ApitoMCPServer>();

function getOrCreateServer(request: Request, env: Env): ApitoMCPServer {
    // Extract API key from multiple sources (in order of preference):
    // 1. Authorization: Bearer <key> header
    // 2. X-Apito-Key: <key> header
    // 3. ?api_key=<key> query parameter (for mcp-remote compatibility)
    const url = new URL(request.url);
    const authHeader = request.headers.get('Authorization');
    const apiKeyHeader = request.headers.get('X-Apito-Key');
    const queryApiKey = url.searchParams.get('api_key');
    const tenantHeader = request.headers.get('X-Apito-Tenant-ID');
    const projectHeader = request.headers.get('X-Apito-Project-Id');

    let authToken: string | null = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
        authToken = authHeader.substring(7);
    } else if (apiKeyHeader) {
        authToken = apiKeyHeader;
    } else if (queryApiKey) {
        authToken = queryApiKey;
    }

    if (!authToken) {
        throw new Error('APITO_API_KEY must be provided via Authorization: Bearer <key> header, X-Apito-Key: <key> header, or ?api_key=<key> query parameter');
    }

    if (/^(cli-|sdk-|mcp-)/.test(authToken)) {
        throw new Error(
            'TOKEN_FORMAT_RETIRED — cli-/sdk-/mcp- prefixed keys are no longer accepted. ' +
                'Generate an apt_ access token in Console → Access Token and use it instead.'
        );
    }

    // Default to system GraphQL endpoint for system queries
    let graphqlEndpoint = env.APITO_GRAPHQL_ENDPOINT || 'https://api.apito.io/system/graphql';

    // If user provided /secured/graphql, convert to /system/graphql for system queries
    if (graphqlEndpoint.includes('/secured/graphql')) {
        graphqlEndpoint = graphqlEndpoint.replace('/secured/graphql', '/system/graphql');
    }

    const tenantId = tenantHeader?.trim() || undefined;
    const projectId = projectHeader?.trim() || undefined;
    const baseScopeConfig = projectScopeConfigFromEnv({
        APITO_ALLOWED_PROJECT_IDS: env.APITO_ALLOWED_PROJECT_IDS,
        APITO_DEFAULT_PROJECT_ID: env.APITO_DEFAULT_PROJECT_ID,
        APITO_ALLOWED_TENANTS_BY_PROJECT: env.APITO_ALLOWED_TENANTS_BY_PROJECT,
        APITO_PROJECT_SCOPE_TTL_SECONDS: env.APITO_PROJECT_SCOPE_TTL_SECONDS,
    });
    if (projectId && !baseScopeConfig.allowedProjectIds.has(projectId)) {
        throw new Error(`PROJECT_SCOPE_DENIED: project "${projectId}" is not explicitly allowed`);
    }
    // Immutable per-request config — never mutate the env-derived object.
    const scopeConfig = projectId
        ? { ...baseScopeConfig, defaultProjectId: projectId }
        : baseScopeConfig;
    const graphqlClientOptions = { projectId, tenantId };

    // Cache server instances per API key + exact project/tenant + endpoint.
    // Leases remain project-bound; there is no mutable current-project state.
    const cacheKey = `${authToken}:${graphqlEndpoint}:${projectId ?? ''}:${tenantId ?? ''}`;
    if (serverCache.has(cacheKey)) {
        return serverCache.get(cacheKey)!;
    }

    const server = new ApitoMCPServer(graphqlEndpoint, authToken, graphqlClientOptions, scopeConfig);
    serverCache.set(cacheKey, server);
    return server;
}

const CORS_VARY = 'Authorization, X-Apito-Key, X-Apito-Project-Id, X-Apito-Tenant-ID';

export default {
    async fetch(request: Request, env: Env): Promise<Response> {
        const url = new URL(request.url);
        const pathname = url.pathname;

        // Handle CORS preflight
        if (request.method === 'OPTIONS') {
            return new Response(null, {
                status: 204,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept, X-Apito-Key, X-Apito-Project-Id, X-Apito-Tenant-ID',
                    'Access-Control-Max-Age': '86400',
                    Vary: CORS_VARY,
                },
            });
        }

        // Handle SSE endpoint
        if (pathname === '/sse' || pathname.endsWith('/sse')) {
            try {
                const server = getOrCreateServer(request, env);
                const mcpServer = server.getServer();

                if (request.method === 'GET') {
                    // SSE stream for MCP communication
                    const encoder = new TextEncoder();
                    const stream = new ReadableStream({
                        async start(controller) {
                            try {
                                // Send initialization response (MCP protocol)
                                const initResponse = {
                                    jsonrpc: '2.0',
                                    id: 1,
                                    result: {
                                        protocolVersion: '2024-11-05',
                                        capabilities: {
                                            tools: {},
                                            prompts: {},
                                            resources: {},
                                        },
                                        serverInfo: {
                                            name: 'apito-mcp',
                                            version: '1.0.0',
                                        },
                                    },
                                };

                                // Send initialization response via SSE
                                const sseData = `data: ${JSON.stringify(initResponse)}\n\n`;
                                controller.enqueue(encoder.encode(sseData));

                                // Keep stream open for ongoing communication
                                // In a real implementation, you'd handle incoming messages via POST
                                // and send responses via this SSE stream
                            } catch (error: any) {
                                const errorMsg = {
                                    jsonrpc: '2.0',
                                    id: 1,
                                    error: {
                                        code: -32000,
                                        message: error.message || 'Internal error',
                                    },
                                };
                                const sseData = `data: ${JSON.stringify(errorMsg)}\n\n`;
                                controller.enqueue(encoder.encode(sseData));
                                controller.close();
                            }
                        },
                    });

                    return new Response(stream, {
                        headers: {
                            'Content-Type': 'text/event-stream',
                            'Cache-Control': 'no-cache',
                            'Connection': 'keep-alive',
                            'Access-Control-Allow-Origin': '*',
                            Vary: CORS_VARY,
                        },
                    });
                } else if (request.method === 'POST') {
                    // Handle MCP JSON-RPC messages
                    try {
                        const body = await request.json() as {
                            jsonrpc?: string;
                            id?: string | number;
                            method?: string;
                            params?: any;
                        };

                        const server = getOrCreateServer(request, env);

                        // Handle MCP request through server
                        const response = await server.handleMCPRequest(body);

                        return new Response(JSON.stringify(response), {
                            headers: {
                                'Content-Type': 'application/json',
                                'Access-Control-Allow-Origin': '*',
                                Vary: CORS_VARY,
                            },
                        });
                    } catch (error: any) {
                        return new Response(
                            JSON.stringify({
                                jsonrpc: '2.0',
                                id: null,
                                error: {
                                    code: -32000,
                                    message: error.message || 'Internal error',
                                },
                            }),
                            {
                                status: 200, // JSON-RPC errors still return 200
                                headers: {
                                    'Content-Type': 'application/json',
                                    'Access-Control-Allow-Origin': '*',
                                    Vary: CORS_VARY,
                                },
                            }
                        );
                    }
                }
            } catch (error: any) {
                return new Response(
                    JSON.stringify({
                        jsonrpc: '2.0',
                        id: null,
                        error: {
                            code: -32000,
                            message: error.message || 'Internal server error',
                        },
                    }),
                    {
                        status: 200,
                        headers: {
                            'Content-Type': 'application/json',
                            'Access-Control-Allow-Origin': '*',
                            Vary: CORS_VARY,
                        },
                    }
                );
            }
        }

        // Default response for root or other paths
        return new Response(
            JSON.stringify({
                message: 'Apito MCP Server',
                version: '1.0.0',
                endpoint: '/sse',
                status: 'ready',
            }),
            {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    Vary: CORS_VARY,
                },
            }
        );
    },
};
