import type { ApitoGraphQLClient, GraphQLRequestOptions } from '../graphql-client.js';

export const MAX_LOG_ROWS = 50;
export const MAX_LOG_FIELD_BYTES = 4096;

const PAYLOAD_FIELDS = [
  'request_payload',
  'response_payload',
  'graphql_query',
  'graphql_variables',
  'query_text',
  'query_args_json',
  'error_stack',
  'metadata_json',
  'tags_json',
] as const;

const SEARCH_SYSTEM_LOGS = `
  query SearchSystemLogs(
    $trace_id: String
    $request_id: String
    $project_id: String
    $tenant_id: String
    $scope_key: String
    $user_id: String
    $role_id: String
    $sources: [String]
    $kinds: [String]
    $levels: [String]
    $statuses: [String]
    $environment: String
    $method: String
    $status_code: Int
    $model: String
    $driver_engine: String
    $nats_subject: String
    $from_ns: String
    $to_ns: String
    $min_duration_us: Int
    $text: String
    $cursor: String
    $limit: Int
    $ascending: Boolean
  ) {
    searchSystemLogs(
      trace_id: $trace_id
      request_id: $request_id
      project_id: $project_id
      tenant_id: $tenant_id
      scope_key: $scope_key
      user_id: $user_id
      role_id: $role_id
      sources: $sources
      kinds: $kinds
      levels: $levels
      statuses: $statuses
      environment: $environment
      method: $method
      status_code: $status_code
      model: $model
      driver_engine: $driver_engine
      nats_subject: $nats_subject
      from_ns: $from_ns
      to_ns: $to_ns
      min_duration_us: $min_duration_us
      text: $text
      cursor: $cursor
      limit: $limit
      ascending: $ascending
    ) {
      total
      next_cursor
      results {
        id
        trace_id
        parent_event_id
        request_id
        span_id
        occurred_at
        occurred_at_ns
        duration_ms
        duration_us
        source
        kind
        level
        status
        environment
        project_id
        project_name
        tenant_id
        scope_key
        user_id
        role_id
        method
        route_template
        path
        status_code
        client_ip
        user_agent
        graphql_op_type
        graphql_op_name
        graphql_query
        driver_engine
        db_operation
        model
        query_text
        nats_subject
        runtime
        error_code
        error_message
        truncated
        legacy_slow_query
      }
    }
  }
`;

const SYSTEM_LOG = `
  query SystemLog($id: String!) {
    systemLog(id: $id) {
      id
      trace_id
      parent_event_id
      request_id
      span_id
      occurred_at
      occurred_at_ns
      duration_ms
      duration_us
      source
      kind
      level
      status
      environment
      project_id
      project_name
      tenant_id
      scope_key
      user_id
      role_id
      auth_plane
      auth_type
      token_fingerprint
      method
      route_template
      path
      query_string
      status_code
      request_bytes
      response_bytes
      client_ip
      user_agent
      graphql_surface
      graphql_op_type
      graphql_op_name
      graphql_root_fields
      graphql_query
      graphql_variables
      driver_engine
      db_operation
      model
      query_text
      query_args_json
      nats_subject
      nats_direction
      queue_group
      message_id
      invocation_id
      runtime
      error_code
      error_class
      error_message
      error_stack
      request_payload
      response_payload
      metadata_json
      tags_json
      truncated
      legacy_slow_query
    }
  }
`;

const SYSTEM_LOG_TRACE = `
  query SystemLogTrace($trace_id: String!) {
    systemLogTrace(trace_id: $trace_id) {
      id
      trace_id
      parent_event_id
      request_id
      span_id
      occurred_at
      occurred_at_ns
      duration_ms
      duration_us
      source
      kind
      level
      status
      project_id
      project_name
      tenant_id
      method
      path
      status_code
      graphql_op_name
      model
      db_operation
      error_message
    }
  }
`;

const SYSTEM_LOG_STATS = `
  query SystemLogStats(
    $trace_id: String
    $project_id: String
    $tenant_id: String
    $sources: [String]
    $kinds: [String]
    $levels: [String]
    $statuses: [String]
    $from_ns: String
    $to_ns: String
    $text: String
    $group_by: String
    $interval_s: Int
  ) {
    systemLogStats(
      trace_id: $trace_id
      project_id: $project_id
      tenant_id: $tenant_id
      sources: $sources
      kinds: $kinds
      levels: $levels
      statuses: $statuses
      from_ns: $from_ns
      to_ns: $to_ns
      text: $text
      group_by: $group_by
      interval_s: $interval_s
    ) {
      store {
        total_events
        oldest_ns
        newest_ns
        size_bytes
        appended
        dropped
        batches_flushed
      }
      health {
        engine
        path
        open
        writable
        schema_version
        wal_enabled
        fts_enabled
        error
      }
      aggregates {
        buckets {
          key
          bucket_ns
          count
          avg_duration_us
          max_duration_us
        }
      }
    }
  }
`;

export type SystemLogEvent = Record<string, unknown>;

export type SearchSystemLogsArgs = {
  trace_id?: string;
  request_id?: string;
  project_id?: string;
  tenant_id?: string;
  scope_key?: string;
  user_id?: string;
  role_id?: string;
  sources?: string[];
  kinds?: string[];
  levels?: string[];
  statuses?: string[];
  environment?: string;
  method?: string;
  status_code?: number;
  model?: string;
  driver_engine?: string;
  nats_subject?: string;
  from_ns?: string;
  to_ns?: string;
  min_duration_us?: number;
  text?: string;
  cursor?: string;
  limit?: number;
  ascending?: boolean;
};

export type SummarizeSystemLogsArgs = {
  trace_id?: string;
  project_id?: string;
  tenant_id?: string;
  sources?: string[];
  kinds?: string[];
  levels?: string[];
  statuses?: string[];
  from_ns?: string;
  to_ns?: string;
  text?: string;
  group_by?: string;
  interval_s?: number;
};

export function clampLogLimit(limit?: number): number {
  if (limit == null || !Number.isFinite(limit) || limit <= 0) {
    return MAX_LOG_ROWS;
  }
  return Math.min(Math.floor(limit), MAX_LOG_ROWS);
}

function truncateUtf8(value: string, maxBytes: number): string {
  const bytes = Buffer.from(value, 'utf8');
  if (bytes.length <= maxBytes) {
    return value;
  }
  return `${Buffer.from(bytes.subarray(0, maxBytes)).toString('utf8')}…[truncated]`;
}

export function boundLogEvent(event: SystemLogEvent): SystemLogEvent {
  const out: SystemLogEvent = { ...event };
  for (const field of PAYLOAD_FIELDS) {
    const value = out[field];
    if (typeof value === 'string' && value.length > 0) {
      out[field] = truncateUtf8(value, MAX_LOG_FIELD_BYTES);
    }
  }
  return out;
}

export function boundLogEvents(events: SystemLogEvent[]): SystemLogEvent[] {
  return events.slice(0, MAX_LOG_ROWS).map((event) => boundLogEvent(event));
}

function pickDefined<T extends Record<string, unknown>>(args: T): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(args)) {
    if (value !== undefined && value !== null && value !== '') {
      out[key] = value;
    }
  }
  return out;
}

export async function searchSystemLogs(
  client: ApitoGraphQLClient,
  args: SearchSystemLogsArgs,
  reqOpts?: GraphQLRequestOptions
) {
  const variables = pickDefined({
    ...args,
    limit: clampLogLimit(args.limit),
  });
  const result = await client.request<{
    searchSystemLogs: {
      total?: number;
      next_cursor?: string;
      results?: SystemLogEvent[];
    };
  }>(SEARCH_SYSTEM_LOGS, variables, reqOpts);
  const page = result.searchSystemLogs ?? { results: [] };
  return {
    total: page.total,
    next_cursor: page.next_cursor,
    results: boundLogEvents(page.results ?? []),
    row_cap: MAX_LOG_ROWS,
  };
}

export async function getSystemLog(
  client: ApitoGraphQLClient,
  id: string,
  reqOpts?: GraphQLRequestOptions
) {
  const result = await client.request<{ systemLog: SystemLogEvent | null }>(
    SYSTEM_LOG,
    { id },
    reqOpts
  );
  const event = result.systemLog;
  if (!event) {
    return null;
  }
  return boundLogEvent(event);
}

export async function getSystemTrace(
  client: ApitoGraphQLClient,
  traceId: string,
  reqOpts?: GraphQLRequestOptions
) {
  const result = await client.request<{ systemLogTrace: SystemLogEvent[] | null }>(
    SYSTEM_LOG_TRACE,
    { trace_id: traceId },
    reqOpts
  );
  const events = result.systemLogTrace ?? [];
  return {
    trace_id: traceId,
    count: events.length,
    results: boundLogEvents(events),
    row_cap: MAX_LOG_ROWS,
    truncated: events.length > MAX_LOG_ROWS,
  };
}

export async function summarizeSystemLogs(
  client: ApitoGraphQLClient,
  args: SummarizeSystemLogsArgs,
  reqOpts?: GraphQLRequestOptions
) {
  const variables = pickDefined(args);
  const result = await client.request<{
    systemLogStats: {
      aggregates?: {
        buckets?: Array<Record<string, unknown>>;
      };
    };
  }>(SYSTEM_LOG_STATS, variables, reqOpts);
  const buckets = result.systemLogStats?.aggregates?.buckets ?? [];
  return {
    aggregates: {
      buckets: buckets.slice(0, MAX_LOG_ROWS),
    },
    bucket_cap: MAX_LOG_ROWS,
    truncated: buckets.length > MAX_LOG_ROWS,
  };
}

export async function getLogStoreHealth(
  client: ApitoGraphQLClient,
  reqOpts?: GraphQLRequestOptions
) {
  const result = await client.request<{
    systemLogStats: {
      store?: Record<string, unknown>;
      health?: Record<string, unknown>;
    };
  }>(SYSTEM_LOG_STATS, {}, reqOpts);
  return {
    health: result.systemLogStats?.health ?? null,
    store: result.systemLogStats?.store ?? null,
  };
}
