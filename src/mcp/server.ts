import { captureException } from '@sentry/cloudflare';
import { Dataset } from './dataset';
import { TOOL_DEFINITIONS, ToolInputError, callTool, toolExists } from './tools';

// Dual-era per the 2026-07-28 spec: modern clients send their version in `_meta` on
// every request, legacy clients negotiate it once through `initialize`.
const MODERN_VERSIONS = ['2026-07-28'];
const LEGACY_VERSIONS = ['2025-11-25', '2025-06-18', '2025-03-26'];
const SUPPORTED_VERSIONS = [...MODERN_VERSIONS, ...LEGACY_VERSIONS];

const SERVER_INFO = { name: 'historical-fantasy-football-stats', version: '1.0.0' };
const CAPABILITIES = { tools: {} };
const INSTRUCTIONS =
  'NFL fantasy football stats for QBs, RBs, WRs and TEs since 1970, with weekly data for recent seasons. ' +
  'Call get_data_info to see coverage and freshness. Any tool that returns points accepts custom scoring.';

// Results only change when a deployment does, so clients can cache lists briefly.
const LIST_TTL_MS = 3_600_000;

const ERROR = {
  parse: -32700,
  invalidRequest: -32600,
  methodNotFound: -32601,
  invalidParams: -32602,
  internal: -32603,
  headerMismatch: -32020,
  unsupportedVersion: -32022,
} as const;

// No valid request comes close to this, so anything larger is rejected before parsing.
const MAX_BODY_BYTES = 16_384;

const META_VERSION = 'io.modelcontextprotocol/protocolVersion';
const META_SERVER_INFO = 'io.modelcontextprotocol/serverInfo';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers':
    'Content-Type, Accept, MCP-Protocol-Version, Mcp-Method, Mcp-Name, Mcp-Session-Id, Last-Event-ID',
  'Access-Control-Max-Age': '86400',
};

type RequestId = string | number | null;

interface RpcRequest {
  jsonrpc?: string;
  id?: RequestId;
  method?: unknown;
  params?: Record<string, unknown> & { _meta?: Record<string, unknown> };
}

class RpcFailure extends Error {
  readonly code: number;
  readonly status: number;
  readonly data?: unknown;

  constructor(code: number, message: string, status: number, data?: unknown) {
    super(message);
    this.code = code;
    this.status = status;
    this.data = data;
  }
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

function failure(id: RequestId, error: RpcFailure): Response {
  const { code, message, data } = error;
  return json({ jsonrpc: '2.0', id, error: { code, message, ...(data ? { data } : {}) } }, error.status);
}

function unsupportedVersion(requested: unknown): RpcFailure {
  return new RpcFailure(ERROR.unsupportedVersion, 'Unsupported protocol version', 400, {
    supported: SUPPORTED_VERSIONS,
    requested,
  });
}

function validateModernHeaders(request: Request, body: RpcRequest, version: unknown, method: string) {
  const mismatch = (message: string) => new RpcFailure(ERROR.headerMismatch, `Header mismatch: ${message}`, 400);

  if (typeof version !== 'string' || !MODERN_VERSIONS.includes(version)) throw unsupportedVersion(version);

  const headerVersion = request.headers.get('MCP-Protocol-Version');
  if (headerVersion !== version) {
    throw mismatch(`MCP-Protocol-Version header '${headerVersion}' does not match body value '${version}'`);
  }

  const headerMethod = request.headers.get('Mcp-Method');
  if (headerMethod !== method) {
    throw mismatch(`Mcp-Method header '${headerMethod}' does not match body value '${method}'`);
  }

  if (method === 'tools/call') {
    const name = body.params?.name;
    const headerName = request.headers.get('Mcp-Name');
    if (headerName !== name) {
      throw mismatch(`Mcp-Name header '${headerName}' does not match body value '${String(name)}'`);
    }
  }
}

function toolResult(payload: unknown, isError = false) {
  const text = typeof payload === 'string' ? payload : JSON.stringify(payload);
  return {
    content: [{ type: 'text', text }],
    ...(isError ? { isError: true } : { structuredContent: payload }),
  };
}

async function runTool(body: RpcRequest, loadDataset: () => Promise<Dataset>) {
  const { name, arguments: toolArgs = {} } = body.params ?? {};

  if (typeof name !== 'string' || !toolExists(name)) {
    throw new RpcFailure(ERROR.invalidParams, `Unknown tool: ${String(name)}`, 200);
  }
  if (typeof toolArgs !== 'object' || toolArgs === null || Array.isArray(toolArgs)) {
    throw new RpcFailure(ERROR.invalidParams, 'arguments must be an object', 200);
  }

  try {
    return toolResult(callTool(await loadDataset(), name, toolArgs as Record<string, unknown>));
  } catch (error) {
    // Bad arguments go back to the model as a tool error so that it can correct them.
    if (error instanceof ToolInputError) return toolResult(error.message, true);
    throw error;
  }
}

function initializeResult(params: RpcRequest['params']) {
  const requested = params?.protocolVersion;
  const protocolVersion =
    typeof requested === 'string' && LEGACY_VERSIONS.includes(requested) ? requested : LEGACY_VERSIONS[0];

  return { protocolVersion, capabilities: CAPABILITIES, serverInfo: SERVER_INFO, instructions: INSTRUCTIONS };
}

async function handleModern(body: RpcRequest, method: string, loadDataset: () => Promise<Dataset>) {
  const common = { resultType: 'complete', _meta: { [META_SERVER_INFO]: SERVER_INFO } };

  switch (method) {
    case 'server/discover':
      return {
        ...common,
        supportedVersions: SUPPORTED_VERSIONS,
        capabilities: CAPABILITIES,
        instructions: INSTRUCTIONS,
        ttlMs: LIST_TTL_MS,
        cacheScope: 'public',
      };
    case 'tools/list':
      return { ...common, tools: TOOL_DEFINITIONS, ttlMs: LIST_TTL_MS, cacheScope: 'public' };
    case 'tools/call':
      return { ...common, ...(await runTool(body, loadDataset)) };
    default:
      throw new RpcFailure(ERROR.methodNotFound, 'Method not found', 404);
  }
}

async function handleLegacy(request: Request, body: RpcRequest, method: string, loadDataset: () => Promise<Dataset>) {
  const headerVersion = request.headers.get('MCP-Protocol-Version');
  if (headerVersion && !LEGACY_VERSIONS.includes(headerVersion)) throw unsupportedVersion(headerVersion);

  switch (method) {
    case 'initialize':
      return initializeResult(body.params);
    case 'ping':
      return {};
    case 'tools/list':
      return { tools: TOOL_DEFINITIONS };
    case 'tools/call':
      return runTool(body, loadDataset);
    default:
      throw new RpcFailure(ERROR.methodNotFound, 'Method not found', 200);
  }
}

/**
 * Stateless MCP endpoint. Every response is a single JSON object, which the
 * Streamable HTTP transport allows, so there are no sessions or streams to manage.
 *
 * The spec's Origin check guards local servers against DNS rebinding. This server
 * is public, unauthenticated and read-only, so every Origin is valid by design.
 */
export async function handleMcpRequest(request: Request, loadDataset: () => Promise<Dataset>): Promise<Response> {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS });
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405, headers: { ...CORS_HEADERS, Allow: 'POST, OPTIONS' } });
  }

  const declaredLength = Number(request.headers.get('Content-Length') ?? 0);
  if (declaredLength > MAX_BODY_BYTES) {
    return failure(null, new RpcFailure(ERROR.invalidRequest, 'Request too large', 413));
  }

  let body: RpcRequest;
  try {
    const text = await request.text();
    if (text.length > MAX_BODY_BYTES) {
      return failure(null, new RpcFailure(ERROR.invalidRequest, 'Request too large', 413));
    }
    body = JSON.parse(text);
  } catch {
    return failure(null, new RpcFailure(ERROR.parse, 'Parse error', 400));
  }

  const isObject = typeof body === 'object' && body !== null && !Array.isArray(body);
  if (!isObject || body.jsonrpc !== '2.0' || typeof body.method !== 'string') {
    return failure(null, new RpcFailure(ERROR.invalidRequest, 'Invalid request', 400));
  }

  const { id, method } = body;
  if (id === undefined) return new Response(null, { status: 202, headers: CORS_HEADERS });

  try {
    const version = body.params?._meta?.[META_VERSION];
    const isModern = version !== undefined;
    if (isModern) validateModernHeaders(request, body, version, method);

    const result = isModern
      ? await handleModern(body, method, loadDataset)
      : await handleLegacy(request, body, method, loadDataset);

    return json({ jsonrpc: '2.0', id, result });
  } catch (error) {
    if (error instanceof RpcFailure) return failure(id, error);
    console.error('MCP request failed', error);
    // Answered below as a JSON-RPC error, so Sentry would never see it as a thrown one.
    captureException(error, { tags: { mcp_method: method, mcp_tool: String(body.params?.name ?? 'none') } });
    return failure(id, new RpcFailure(ERROR.internal, 'Internal error', 500));
  }
}
