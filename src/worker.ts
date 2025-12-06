/**
 * Cloudflare Worker entry point for Apito MCP Server
 * Implements SSE (Server-Sent Events) transport for remote MCP access
 * Based on Cloudflare's remote MCP server guide: https://developers.cloudflare.com/agents/guides/remote-mcp-server/
 */

import { ApitoMCPServer } from './index.js';

export interface Env {
    APITO_GRAPHQL_ENDPOINT?: string;
    APITO_AUTH_TOKEN?: string;
    APITO_API_KEY?: string;
}

// Global server instance (reused across requests)
let globalServer: ApitoMCPServer | null = null;
let globalGraphqlEndpoint: string | null = null;

function getOrCreateServer(env: Env): ApitoMCPServer {
    // Default to system GraphQL endpoint for system queries
    let graphqlEndpoint = env.APITO_GRAPHQL_ENDPOINT || 'https://api.apito.io/system/graphql';

    // If user provided /secured/graphql, convert to /system/graphql for system queries
    if (graphqlEndpoint.includes('/secured/graphql')) {
        graphqlEndpoint = graphqlEndpoint.replace('/secured/graphql', '/system/graphql');
    }

    // Reuse server if endpoint hasn't changed
    if (globalServer && globalGraphqlEndpoint === graphqlEndpoint) {
        return globalServer;
    }

    const authToken = env.APITO_AUTH_TOKEN || env.APITO_API_KEY;
    if (!authToken) {
        throw new Error('APITO_AUTH_TOKEN or APITO_API_KEY not configured');
    }

    globalGraphqlEndpoint = graphqlEndpoint;
    globalServer = new ApitoMCPServer(graphqlEndpoint, authToken);
    return globalServer;
}

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
                    'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept',
                    'Access-Control-Max-Age': '86400',
                },
            });
        }

        // Handle SSE endpoint
        if (pathname === '/sse' || pathname.endsWith('/sse')) {
            try {
                const server = getOrCreateServer(env);
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

                        const server = getOrCreateServer(env);

                        // Handle MCP request through server
                        const response = await server.handleMCPRequest(body);

                        return new Response(JSON.stringify(response), {
                            headers: {
                                'Content-Type': 'application/json',
                                'Access-Control-Allow-Origin': '*',
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
                },
            }
        );
    },
};
