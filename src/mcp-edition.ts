/** Which MCP tool surface to expose. `pro` = full (default); `open` = OSS-safe tools only. */
export type McpEdition = 'open' | 'pro';

export function getMcpEdition(): McpEdition {
  const raw =
    typeof process !== 'undefined' ? process.env?.APITO_MCP_EDITION?.trim().toLowerCase() : '';
  if (raw === 'open') {
    return 'open';
  }
  return 'pro';
}

/** Tool metadata: pro-only tools are hidden when APITO_MCP_EDITION=open. */
export type ToolEditionMeta = {
  name: string;
  proOnly?: boolean;
};

export function filterToolsByEdition<T extends { name: string; proOnly?: boolean }>(
  tools: T[],
  edition: McpEdition = getMcpEdition()
): T[] {
  if (edition === 'pro') {
    return tools;
  }
  return tools.filter((t) => !t.proOnly);
}
