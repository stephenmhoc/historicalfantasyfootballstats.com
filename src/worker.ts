import { Dataset, type PackedLookup } from './mcp/dataset';
import { handleMcpRequest } from './mcp/server';

interface Env {
  ASSETS: { fetch: (input: Request | string) => Promise<Response> };
  MCP_RATE_LIMITER: { limit: (options: { key: string }) => Promise<{ success: boolean }> };
}

// Assets are immutable per deployment, so an isolate only needs to load them once.
let dataset: Promise<Dataset> | undefined;

async function fetchAsset(env: Env, origin: string, path: string) {
  const response = await env.ASSETS.fetch(`${origin}/data/mcp/${path}`);
  if (!response.ok) throw new Error(`${path} returned HTTP ${response.status}`);
  return response;
}

async function loadDataset(env: Env, origin: string) {
  const [stats, lookup] = await Promise.all([
    fetchAsset(env, origin, 'stats.bin').then((response) => response.arrayBuffer()),
    fetchAsset(env, origin, 'lookup.json').then((response) => response.json() as Promise<PackedLookup>),
  ]);
  return new Dataset(stats, lookup);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { origin, pathname } = new URL(request.url);
    if (pathname !== '/mcp') return env.ASSETS.fetch(request);

    // Browsers and crawlers get the docs page. MCP clients always accept event streams.
    const isPageRequest =
      (request.method === 'GET' || request.method === 'HEAD') &&
      !request.headers.get('Accept')?.includes('text/event-stream');
    if (isPageRequest) return env.ASSETS.fetch(request);

    const key = request.headers.get('CF-Connecting-IP') ?? 'unknown';
    const { success } = await env.MCP_RATE_LIMITER.limit({ key });
    if (!success) {
      return new Response('Too Many Requests', {
        status: 429,
        headers: { 'Retry-After': '10', 'Access-Control-Allow-Origin': '*' },
      });
    }

    return handleMcpRequest(request, () => {
      dataset ??= loadDataset(env, origin).catch((error) => {
        dataset = undefined; // Let the next request retry instead of caching the failure.
        throw error;
      });
      return dataset;
    });
  },
};
